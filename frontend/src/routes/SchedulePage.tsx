import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Active,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import {
  findShiftConflicts,
  hasBlockingConflict,
  type ConflictReason,
  type Employee,
  type Shift,
} from "@shiftly/shared";
import { AvailabilityForm } from "../features/availability/AvailabilityForm";
import { useAvailability } from "../features/availability/use-availability";
import { AuditLogPanel } from "../features/audit-log/AuditLogPanel";
import { EmployeeRoster } from "../features/employees/EmployeeRoster";
import { useEmployees } from "../features/employees/use-employees";
import { NotificationBell } from "../features/notifications/NotificationBell";
import { CommandPalette } from "../features/shifts/dnd/CommandPalette";
import { STATUS_STYLES } from "../features/shifts/dnd/DraggableShiftTile";
import { ShiftDetailsPopover } from "../features/shifts/dnd/ShiftDetailsPopover";
import { createDragAnnouncements, dragScreenReaderInstructions } from "../features/shifts/dnd/announcements";
import { createGridCoordinateGetter } from "../features/shifts/dnd/coordinateGetter";
import {
  DEFAULT_DURATION_MINUTES,
  dateToSlot,
  parseSlotId,
  slotToDate,
} from "../features/shifts/dnd/grid";
import { useIsCoarsePointer } from "../features/shifts/dnd/useIsCoarsePointer";
import type { ShiftDetailsValues } from "../features/shifts/dnd/shift-details-schema";
import { WeekCalendar } from "../features/shifts/WeekCalendar";
import {
  useCreateShift,
  useDeleteShift,
  useShifts,
  useUpdateShift,
} from "../features/shifts/use-shifts";
import { SwapRequestPanel } from "../features/swaps/SwapRequestPanel";
import { useAuthStore } from "../store/auth-store";
import { usePermission } from "../lib/policy";
import { addDays, getWeekStart } from "../lib/week";

const weekRangeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

type DragData =
  | { type: "shift"; shift: Shift }
  | { type: "employee"; employee: Employee };

// What's staged after a valid drop/palette pick, waiting on the one
// remaining decision drag-and-drop can't make for you: location, status,
// and an optional note. Moving an existing shift skips this entirely — the
// drop itself is the confirmation, since nothing but position changed.
type PendingDetails =
  | { mode: "create"; employeeId: string; startTime: string; endTime: string }
  | { mode: "edit"; shift: Shift };

type PaletteContext =
  | { mode: "create"; employee: Employee }
  | { mode: "move"; shift: Shift };

function getDragData(active: Active): DragData | undefined {
  return active.data.current as DragData | undefined;
}

export function SchedulePage() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  // Every branch below reads from this same policy table (see
  // @shiftly/shared/policy) instead of comparing user.role directly — the
  // backend enforces the identical checks, so what renders here always
  // matches what the API will actually allow.
  const canManageEmployees = usePermission("employee:manage");
  const canViewEmployees = usePermission("employee:view");
  const canCreateShift = usePermission("shift:create");
  const canEditShift = usePermission("shift:update");
  const canDeleteShift = usePermission("shift:delete");
  const canSubmitAvailability = usePermission("availability:submit");
  const canViewAuditLog = usePermission("auditLog:view");
  const canRequestSwap = usePermission("swap:request");
  const canDecideSwap = usePermission("swap:decide");
  const canSeeSwaps = canRequestSwap || canDecideSwap;
  const hasSidePanel = canManageEmployees || canCreateShift || canSubmitAvailability;

  // Touch drag has no good answer for "the finger occludes the drop
  // target" — coarse-pointer devices skip dnd-kit and use the same command
  // palette keyboard users get, rather than a separate mobile mode.
  const isCoarsePointer = useIsCoarsePointer();
  const dragEnabled = canCreateShift && !isCoarsePointer;

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const { data: employees = [] } = useEmployees({ enabled: canViewEmployees });
  const {
    data: shifts = [],
    isLoading,
    isError,
    refetch,
  } = useShifts({ start: weekStart.toISOString(), end: weekEnd.toISOString() });
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const [pendingDetails, setPendingDetails] = useState<PendingDetails | null>(null);
  const [palette, setPalette] = useState<PaletteContext | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [dragConflicts, setDragConflicts] = useState<ConflictReason[]>([]);
  const currentSlotRef = useRef<{ dayIndex: number; slotIndex: number } | null>(null);

  const activeEmployeeId =
    activeDrag?.type === "shift" ? activeDrag.shift.employeeId : activeDrag?.employee.id;
  const { data: dragAvailability = [] } = useAvailability(activeEmployeeId, {
    enabled: dragEnabled && Boolean(activeEmployeeId),
  });

  // The palette can be open without any drag in progress (opened via "New
  // shift…" / "Move…"), so it needs its own availability fetch scoped to
  // whichever employee it's currently placing — not activeEmployeeId, which
  // is only set while an actual drag is happening.
  const paletteEmployeeId =
    palette?.mode === "move" ? palette.shift.employeeId : palette?.employee.id;
  const { data: paletteAvailability = [] } = useAvailability(paletteEmployeeId, {
    enabled: Boolean(palette),
  });

  function conflictsFor(active: Active, over: Over | null): ConflictReason[] {
    const data = getDragData(active);
    if (!data || !over) return [];
    const slot = parseSlotId(over.id);
    if (!slot) return [];
    const start = slotToDate(weekStart, slot.dayIndex, slot.slotIndex);

    if (data.type === "shift") {
      const durationMs =
        new Date(data.shift.endTime).getTime() - new Date(data.shift.startTime).getTime();
      const end = new Date(start.getTime() + durationMs);
      return findShiftConflicts(
        {
          employeeId: data.shift.employeeId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          excludeShiftId: data.shift.id,
        },
        { existingShifts: shifts, availability: dragAvailability },
      );
    }

    const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
    return findShiftConflicts(
      {
        employeeId: data.employee.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      { existingShifts: shifts, availability: dragAvailability },
    );
  }

  function describeActive(active: Active): string {
    const data = getDragData(active);
    if (!data) return "item";
    if (data.type === "shift") {
      const name = employeesById.get(data.shift.employeeId)?.name ?? "Unknown";
      return `${name}'s shift`;
    }
    return `${data.employee.name} (new shift)`;
  }

  // Not memoized: it only wraps a stable ref read, so recreating it each
  // render is cheap — and memoizing a closure that reads a ref is exactly
  // the pattern the React Compiler can't safely verify (the ref access
  // happens later, inside dnd-kit's own event handling, not during render).
  const coordinateGetter = createGridCoordinateGetter(() => currentSlotRef.current);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );
  const announcements = createDragAnnouncements({
    weekStart,
    describeActive,
    getConflicts: conflictsFor,
  });

  function handleDragStart(event: DragStartEvent) {
    const data = getDragData(event.active);
    if (!data) return;
    setActiveDrag(data);
    setDragConflicts([]);
    currentSlotRef.current =
      data.type === "shift"
        ? dateToSlot(weekStart, new Date(data.shift.startTime))
        : { dayIndex: 0, slotIndex: 18 }; // Monday 9:00am — a sensible start for keyboard navigation
  }

  function handleDragOver(event: DragOverEvent) {
    const slot = event.over ? parseSlotId(event.over.id) : null;
    if (slot) currentSlotRef.current = slot;
    setDragConflicts(event.over ? conflictsFor(event.active, event.over) : []);
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = getDragData(event.active);
    const over = event.over;
    setActiveDrag(null);
    setDragConflicts([]);
    currentSlotRef.current = null;
    if (!data || !over) return;

    const slot = parseSlotId(over.id);
    if (!slot) return;
    if (hasBlockingConflict(conflictsFor(event.active, over))) return; // tile springs back — nothing to update

    const start = slotToDate(weekStart, slot.dayIndex, slot.slotIndex);

    if (data.type === "shift") {
      const durationMs =
        new Date(data.shift.endTime).getTime() - new Date(data.shift.startTime).getTime();
      const end = new Date(start.getTime() + durationMs);
      updateShift.mutate({
        id: data.shift.id,
        input: { startTime: start.toISOString(), endTime: end.toISOString() },
      });
    } else {
      const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
      setPendingDetails({
        mode: "create",
        employeeId: data.employee.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDrag(null);
    setDragConflicts([]);
    currentSlotRef.current = null;
  }

  function submitDetails(values: ShiftDetailsValues) {
    if (!pendingDetails) return;
    if (pendingDetails.mode === "create") {
      const endTime = new Date(
        new Date(pendingDetails.startTime).getTime() + values.durationMinutes * 60_000,
      ).toISOString();
      createShift.mutate(
        {
          employeeId: pendingDetails.employeeId,
          startTime: pendingDetails.startTime,
          endTime,
          location: values.location,
          status: values.status,
          note: values.note || undefined,
        },
        { onSuccess: () => setPendingDetails(null) },
      );
    } else {
      const endTime = new Date(
        new Date(pendingDetails.shift.startTime).getTime() + values.durationMinutes * 60_000,
      ).toISOString();
      updateShift.mutate(
        {
          id: pendingDetails.shift.id,
          input: {
            location: values.location,
            status: values.status,
            note: values.note || undefined,
            endTime,
          },
        },
        { onSuccess: () => setPendingDetails(null) },
      );
    }
  }

  function confirmPalette(candidate: { startTime: string; endTime: string }) {
    if (!palette) return;
    if (palette.mode === "move") {
      updateShift.mutate({
        id: palette.shift.id,
        input: { startTime: candidate.startTime, endTime: candidate.endTime },
      });
      setPalette(null);
    } else {
      setPalette(null);
      setPendingDetails({
        mode: "create",
        employeeId: palette.employee.id,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
      });
    }
  }

  const detailsSubmitting = createShift.isPending || updateShift.isPending;
  const detailsError =
    pendingDetails?.mode === "create" ? createShift.error?.message : updateShift.error?.message;

  return (
    <DndContext
      sensors={dragEnabled ? sensors : undefined}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: dragScreenReaderInstructions }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Weekly schedule</h1>
            <p className="text-sm text-slate-500">
              Signed in as {user?.name} ({user?.role})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={clearSession}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>

        {dragEnabled && (
          <p className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            Drag an employee onto the calendar to create a shift, or drag an existing shift to
            move it. Keyboard: Tab to an employee or shift, press Space to pick up, arrow keys to
            move, Space to drop, Escape to cancel — or use a "New shift…"/"Move…" button for the
            same thing via a searchable list.
          </p>
        )}
        {canCreateShift && isCoarsePointer && (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Touch device detected — use "New shift…" next to an employee, or open a shift and
            choose "Move to a different time…" to place shifts via a slot picker instead of
            dragging.
          </p>
        )}

        <div className={`grid grid-cols-1 gap-6 ${hasSidePanel ? "lg:grid-cols-3" : ""}`}>
          {hasSidePanel && (
            <div className="space-y-6 lg:col-span-1">
              {canManageEmployees && (
                <EmployeeRoster
                  dragEnabled={dragEnabled}
                  onOpenPalette={
                    canCreateShift
                      ? (employee) => setPalette({ mode: "create", employee })
                      : undefined
                  }
                />
              )}

              {canSubmitAvailability && user?.employeeId && (
                <AvailabilityForm employeeId={user.employeeId} />
              )}
            </div>
          )}

          <div className={hasSidePanel ? "space-y-3 lg:col-span-2" : "space-y-3"}>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setWeekStart((current) => addDays(current, -7))}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setWeekStart(getWeekStart(new Date()))}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Today
                </button>
                <button
                  onClick={() => setWeekStart((current) => addDays(current, 7))}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
              <p className="text-sm font-medium text-slate-700">
                {weekRangeFormatter.format(weekStart)} –{" "}
                {weekRangeFormatter.format(addDays(weekStart, 6))}
              </p>
            </div>

            {isLoading ? (
              <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Loading schedule...
              </p>
            ) : isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
                <p className="text-sm font-medium text-red-700">Couldn't load the schedule.</p>
                <button
                  onClick={() => refetch()}
                  className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Try again
                </button>
              </div>
            ) : (
              <WeekCalendar
                weekStart={weekStart}
                shifts={shifts}
                employeesById={employeesById}
                onSelectShift={
                  canEditShift || dragEnabled
                    ? (shift) => setPendingDetails({ mode: "edit", shift })
                    : undefined
                }
                onDeleteShift={
                  canDeleteShift ? (shift) => deleteShift.mutate(shift.id) : undefined
                }
                dragEnabled={dragEnabled}
                activeDragHasConflict={hasBlockingConflict(dragConflicts)}
                emptyStateHint={
                  canCreateShift
                    ? "Drag an employee onto a slot, or use \"New shift…\", to add the first one."
                    : "Nothing scheduled for you this week."
                }
              />
            )}
          </div>
        </div>

        {canSeeSwaps && <SwapRequestPanel shifts={shifts} employees={employees} />}
        {canViewAuditLog && <AuditLogPanel employees={employees} />}
      </div>

      <DragOverlay>
        {activeDrag && (
          <div
            className={`w-40 rounded-md border px-2 py-1 text-[11px] shadow-lg ${
              hasBlockingConflict(dragConflicts)
                ? "border-red-400 bg-red-100 text-red-800"
                : dragConflicts.length > 0
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : activeDrag.type === "shift"
                    ? STATUS_STYLES[activeDrag.shift.status]
                    : "border-indigo-300 bg-indigo-100 text-indigo-900"
            }`}
          >
            {activeDrag.type === "shift" ? (
              <>
                <div className="truncate font-semibold">
                  {employeesById.get(activeDrag.shift.employeeId)?.name ?? "Unknown"}
                </div>
                <div className="truncate">{activeDrag.shift.location}</div>
              </>
            ) : (
              <div className="truncate font-semibold">{activeDrag.employee.name} — new shift</div>
            )}
            {hasBlockingConflict(dragConflicts) && (
              <div className="truncate text-red-700">
                {dragConflicts.some((c) => c.type === "double_booked")
                  ? "Overlaps another shift"
                  : "Outside submitted availability"}
              </div>
            )}
            {!hasBlockingConflict(dragConflicts) &&
              dragConflicts.some((c) => c.type === "no_availability_submitted") && (
                <div className="truncate text-amber-700">No availability on file — can still drop</div>
              )}
          </div>
        )}
      </DragOverlay>

      {pendingDetails && (
        <ShiftDetailsPopover
          title={
            pendingDetails.mode === "create"
              ? `New shift for ${employeesById.get(pendingDetails.employeeId)?.name ?? ""}`
              : `${employeesById.get(pendingDetails.shift.employeeId)?.name ?? ""}'s shift`
          }
          startTime={
            pendingDetails.mode === "create"
              ? pendingDetails.startTime
              : pendingDetails.shift.startTime
          }
          defaults={
            pendingDetails.mode === "edit"
              ? {
                  durationMinutes: Math.round(
                    (new Date(pendingDetails.shift.endTime).getTime() -
                      new Date(pendingDetails.shift.startTime).getTime()) /
                      60_000,
                  ),
                  location: pendingDetails.shift.location,
                  status: pendingDetails.shift.status,
                  note: pendingDetails.shift.note ?? "",
                }
              : undefined
          }
          isSubmitting={detailsSubmitting}
          pendingLabel={pendingDetails.mode === "create" ? "Adding..." : "Saving..."}
          errorMessage={detailsError}
          onCancel={() => setPendingDetails(null)}
          onConfirm={submitDetails}
          onRequestMove={
            pendingDetails.mode === "edit"
              ? () => {
                  const shift = pendingDetails.shift;
                  setPendingDetails(null);
                  setPalette({ mode: "move", shift });
                }
              : undefined
          }
        />
      )}

      {palette && (
        <CommandPalette
          title={
            palette.mode === "move"
              ? `Move ${employeesById.get(palette.shift.employeeId)?.name ?? ""}'s shift`
              : `New shift for ${palette.employee.name}`
          }
          weekStart={weekStart}
          employeeId={palette.mode === "move" ? palette.shift.employeeId : palette.employee.id}
          durationMinutes={
            palette.mode === "move"
              ? Math.round(
                  (new Date(palette.shift.endTime).getTime() -
                    new Date(palette.shift.startTime).getTime()) /
                    60_000,
                )
              : DEFAULT_DURATION_MINUTES
          }
          excludeShiftId={palette.mode === "move" ? palette.shift.id : undefined}
          existingShifts={shifts}
          availability={paletteAvailability}
          onConfirm={confirmPalette}
          onClose={() => setPalette(null)}
        />
      )}
    </DndContext>
  );
}
