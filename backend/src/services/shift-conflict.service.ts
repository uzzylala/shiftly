import type { AvailabilityWindow, Shift } from "@shiftly/shared";
import { prisma } from "../prisma.js";
import type {
  AvailabilityWindow as PrismaAvailabilityWindow,
  Shift as PrismaShift,
} from "../generated/prisma/client.js";

export function toSharedShift(shift: PrismaShift): Shift {
  return {
    id: shift.id,
    organizationId: shift.organizationId,
    employeeId: shift.employeeId,
    startTime: shift.startTime.toISOString(),
    endTime: shift.endTime.toISOString(),
    location: shift.location,
    status: shift.status,
    note: shift.note,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
  };
}

export function toSharedAvailability(
  window: PrismaAvailabilityWindow,
): AvailabilityWindow {
  return {
    id: window.id,
    employeeId: window.employeeId,
    dayOfWeek: window.dayOfWeek as AvailabilityWindow["dayOfWeek"],
    startTime: window.startTime,
    endTime: window.endTime,
    createdAt: window.createdAt.toISOString(),
  };
}

// Loads what findShiftConflicts needs to judge a candidate shift for one
// employee: their other shifts and their submitted availability. Called
// fresh from the DB on every write (shift create/update, and swap
// accept/approve) — this is the authoritative check; a client's own call to
// the same shared function is only ever a courtesy preview against
// whatever it has cached.
export async function loadConflictContext(
  organizationId: string,
  employeeId: string,
) {
  const [shifts, availability] = await Promise.all([
    prisma.shift.findMany({ where: { organizationId, employeeId } }),
    prisma.availabilityWindow.findMany({ where: { employeeId } }),
  ]);
  return {
    existingShifts: shifts.map(toSharedShift),
    availability: availability.map(toSharedAvailability),
  };
}
