import { useMemo } from "react";
import type { Employee, Shift } from "@shiftly/shared";
import { addDays } from "../../lib/week";
import { DraggableShiftTile, STATUS_STYLES } from "./dnd/DraggableShiftTile";
import { DroppableSlot } from "./dnd/DroppableSlot";
import { SLOT_MINUTES } from "./dnd/grid";

const HOUR_HEIGHT_PX = 48;
const SLOT_HEIGHT_PX = HOUR_HEIGHT_PX / (60 / SLOT_MINUTES);
const DAY_COUNT = 7;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

const dayHeaderFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

interface WeekCalendarProps {
  weekStart: Date;
  shifts: Shift[];
  employeesById: Map<string, Employee>;
  // Omit for a view-only calendar (employee/HR) — blocks render as static,
  // unclickable tiles instead of edit affordances.
  onSelectShift?: (shift: Shift) => void;
  onDeleteShift?: (shift: Shift) => void;
  emptyStateHint?: string;
  // Registers droppable cells and draggable tiles with the ambient
  // DndContext (owned by SchedulePage, which also holds the roster's
  // draggable chips — one DndContext has to wrap both).
  dragEnabled?: boolean;
  activeDragHasConflict?: boolean;
}

export function WeekCalendar({
  weekStart,
  shifts,
  employeesById,
  onSelectShift,
  onDeleteShift,
  emptyStateHint = "Use the form on the left to add the first one.",
  dragEnabled = false,
  activeDragHasConflict = false,
}: WeekCalendarProps) {
  const days = useMemo(
    () => Array.from({ length: DAY_COUNT }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const shiftsByDay = useMemo(() => {
    const map = new Map<number, Shift[]>();
    for (let i = 0; i < DAY_COUNT; i++) map.set(i, []);
    for (const shift of shifts) {
      const start = new Date(shift.startTime);
      const dayIndex = days.findIndex((day) => isSameDay(day, start));
      if (dayIndex >= 0) map.get(dayIndex)!.push(shift);
    }
    return map;
  }, [shifts, days]);

  const today = new Date();

  // A view-only calendar with nothing on it replaces itself with a message
  // — but a drag-enabled one always needs its droppable grid rendered, even
  // empty, since that's exactly what a manager drops an employee chip onto.
  if (shifts.length === 0 && !dragEnabled) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">
          No shifts scheduled this week.
        </p>
        <p className="mt-1 text-sm text-slate-500">{emptyStateHint}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {shifts.length === 0 && (
        <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          {emptyStateHint}
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-200">
            <div />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`border-l border-slate-200 px-2 py-2 text-center text-xs font-medium ${
                  isSameDay(day, today)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600"
                }`}
              >
                {dayHeaderFormatter.format(day)}
              </div>
            ))}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            <div
              className="grid grid-cols-[56px_repeat(7,1fr)]"
              style={{ height: HOUR_HEIGHT_PX * 24 }}
            >
              <div className="relative">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className="border-t border-slate-100 px-1 text-right text-[11px] text-slate-400"
                    style={{ height: HOUR_HEIGHT_PX }}
                  >
                    {formatHourLabel(hour)}
                  </div>
                ))}
              </div>

              {days.map((day, dayIndex) => (
                <div
                  key={day.toISOString()}
                  className="relative border-l border-slate-100"
                >
                  {dragEnabled
                    ? Array.from({ length: 24 * SLOTS_PER_HOUR }, (_, slotIndex) => (
                        <DroppableSlot
                          key={slotIndex}
                          dayIndex={dayIndex}
                          slotIndex={slotIndex}
                          heightPx={SLOT_HEIGHT_PX}
                          isConflicting={activeDragHasConflict}
                        />
                      ))
                    : Array.from({ length: 24 }, (_, hour) => (
                        <div
                          key={hour}
                          className="border-t border-slate-100"
                          style={{ height: HOUR_HEIGHT_PX }}
                        />
                      ))}

                  {(shiftsByDay.get(dayIndex) ?? []).map((shift) => {
                    const start = new Date(shift.startTime);
                    const end = new Date(shift.endTime);
                    const top =
                      (minutesSinceMidnight(start) / 60) * HOUR_HEIGHT_PX;
                    const height = Math.max(
                      ((end.getTime() - start.getTime()) / 60_000 / 60) *
                        HOUR_HEIGHT_PX,
                      20,
                    );
                    const employeeName =
                      employeesById.get(shift.employeeId)?.name ?? "Unknown";
                    const timeLabel = `${timeFormatter.format(start)}–${timeFormatter.format(end)}`;

                    if (dragEnabled) {
                      return (
                        <DraggableShiftTile
                          key={shift.id}
                          shift={shift}
                          employeeName={employeeName}
                          timeLabel={timeLabel}
                          top={top}
                          height={height}
                          onSelect={() => onSelectShift?.(shift)}
                          onDelete={() => onDeleteShift?.(shift)}
                        />
                      );
                    }

                    const content = (
                      <>
                        <div className="truncate font-semibold">
                          {employeeName}
                        </div>
                        <div className="truncate">{timeLabel}</div>
                        <div className="truncate opacity-80">
                          {shift.location}
                        </div>
                      </>
                    );
                    const tileClassName = `absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] leading-tight shadow-sm ${STATUS_STYLES[shift.status]}`;

                    return onSelectShift ? (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => onSelectShift(shift)}
                        className={`${tileClassName} hover:brightness-95`}
                        style={{ top, height }}
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        key={shift.id}
                        className={tileClassName}
                        style={{ top, height }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
