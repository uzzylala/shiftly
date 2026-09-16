// The droppable grid a shift can land on: 30-minute cells across the
// visible week. This is the one adjustment from the Phase 3 design note's
// 15-minute default — halves the droppable/DOM node count (7 * 48 instead
// of 7 * 96) while staying fine-grained enough for real shift start times.
export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
export const DAY_COUNT = 7;
export const DEFAULT_DURATION_MINUTES = 4 * 60;

export function slotId(dayIndex: number, slotIndex: number): string {
  return `slot:${dayIndex}:${slotIndex}`;
}

export function parseSlotId(
  id: string | number,
): { dayIndex: number; slotIndex: number } | null {
  const match = /^slot:(\d+):(\d+)$/.exec(String(id));
  if (!match) return null;
  return { dayIndex: Number(match[1]), slotIndex: Number(match[2]) };
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function slotToDate(weekStart: Date, dayIndex: number, slotIndex: number): Date {
  const totalMinutes = slotIndex * SLOT_MINUTES;
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayIndex);
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return date;
}

export function dateToSlot(
  weekStart: Date,
  date: Date,
): { dayIndex: number; slotIndex: number } {
  const dayIndex = Math.round(
    (startOfDay(date).getTime() - startOfDay(weekStart).getTime()) / 86_400_000,
  );
  const minutesIntoDay = date.getHours() * 60 + date.getMinutes();
  const slotIndex = Math.round(minutesIntoDay / SLOT_MINUTES);
  return { dayIndex, slotIndex };
}

export function formatSlotLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
