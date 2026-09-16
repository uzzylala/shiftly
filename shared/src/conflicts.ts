import type { AvailabilityWindow, ConflictReason, Shift } from "./types.js";

/**
 * Pure conflict-detection logic, imported by both the client (instant inline
 * feedback against cached data) and the server (authoritative check against
 * a fresh DB read inside the write transaction). Same function, two call
 * sites — see the shift routes for how the server reconciles a stale client
 * check against its own fresher result.
 */

function toDayOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7; // Mon=0 .. Sun=6, matches the calendar's week start
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseHHmm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function coversRange(
  window: Pick<AvailabilityWindow, "startTime" | "endTime">,
  startMinutes: number,
  endMinutes: number,
): boolean {
  return (
    parseHHmm(window.startTime) <= startMinutes &&
    endMinutes <= parseHHmm(window.endTime)
  );
}

export interface ShiftConflictCandidate {
  employeeId: string;
  startTime: string;
  endTime: string;
  // Pass when editing an existing shift so it doesn't conflict with itself.
  excludeShiftId?: string;
}

export function findShiftConflicts(
  candidate: ShiftConflictCandidate,
  context: { existingShifts: Shift[]; availability: AvailabilityWindow[] },
): ConflictReason[] {
  const conflicts: ConflictReason[] = [];
  const start = new Date(candidate.startTime);
  const end = new Date(candidate.endTime);

  for (const shift of context.existingShifts) {
    if (shift.id === candidate.excludeShiftId) continue;
    if (shift.employeeId !== candidate.employeeId) continue;
    if (shift.status === "cancelled") continue;

    const shiftStart = new Date(shift.startTime);
    const shiftEnd = new Date(shift.endTime);
    if (shiftStart < end && start < shiftEnd) {
      conflicts.push({ type: "double_booked", conflictingShiftId: shift.id });
    }
  }

  const dayWindows = context.availability.filter(
    (window) =>
      window.employeeId === candidate.employeeId &&
      window.dayOfWeek === toDayOfWeek(start),
  );

  if (dayWindows.length === 0) {
    conflicts.push({ type: "no_availability_submitted" });
  } else {
    const startMinutes = minutesOfDay(start);
    const endMinutes = minutesOfDay(end);
    const covered = dayWindows.some((window) =>
      coversRange(window, startMinutes, endMinutes),
    );
    if (!covered) conflicts.push({ type: "outside_availability" });
  }

  return conflicts;
}

// "no_availability_submitted" means we simply have no data for that day —
// it's a heads-up, not evidence the employee is busy. Only reasons backed by
// an actual known conflict (an existing shift, or availability that
// explicitly excludes this time) should block scheduling.
const BLOCKING_CONFLICT_TYPES: ReadonlySet<ConflictReason["type"]> = new Set([
  "double_booked",
  "outside_availability",
]);

export function hasBlockingConflict(conflicts: ConflictReason[]): boolean {
  return conflicts.some((c) => BLOCKING_CONFLICT_TYPES.has(c.type));
}
