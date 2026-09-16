import type { Active, Announcements, Over } from "@dnd-kit/core";
import { hasBlockingConflict, type ConflictReason } from "@shiftly/shared";
import { formatSlotLabel, parseSlotId, slotToDate } from "./grid";

function describeConflict(reason: ConflictReason): string {
  switch (reason.type) {
    case "double_booked":
      return "overlaps another shift";
    case "outside_availability":
      return "outside submitted availability";
    case "no_availability_submitted":
      return "no availability submitted for this day";
  }
}

/**
 * Feeds dnd-kit's own live region (rendered internally whenever
 * `announcements` callbacks are supplied to DndContext) — this is the
 * domain-specific text dnd-kit can't produce on its own, since it only
 * knows draggable/droppable ids, not employee names or conflict state.
 * Conflict info is included in onDragOver, not just onDragEnd, so a screen
 * reader user learns a slot conflicts at the same moment a sighted user
 * sees the red outline.
 */
export function createDragAnnouncements(params: {
  weekStart: Date;
  describeActive: (active: Active) => string;
  // Takes both active and over — deriving the candidate purely from the
  // event's own payload, not component state, so there's no risk of a
  // stale closure racing the setActiveDrag(null) that onDragEnd also does.
  getConflicts: (active: Active, over: Over) => ConflictReason[];
}): Announcements {
  const { weekStart, describeActive, getConflicts } = params;

  function describeOver(active: Active, over: Over | null): string {
    if (!over) return "not over a valid drop target";
    const slot = parseSlotId(over.id);
    if (!slot) return "not over a valid drop target";
    const date = slotToDate(weekStart, slot.dayIndex, slot.slotIndex);
    const conflicts = getConflicts(active, over);
    if (hasBlockingConflict(conflicts)) {
      return `over ${formatSlotLabel(date)}. Conflict: ${conflicts.map(describeConflict).join(", ")}`;
    }
    if (conflicts.length > 0) {
      return `over ${formatSlotLabel(date)}. ${conflicts.map(describeConflict).join(", ")}, but can still be dropped here`;
    }
    return `over ${formatSlotLabel(date)}. No conflicts`;
  }

  return {
    onDragStart({ active }) {
      return `Picked up ${describeActive(active)}. Use arrow keys to move between days and half-hour slots, space to drop, escape to cancel.`;
    },
    onDragOver({ active, over }) {
      return `${describeActive(active)}, ${describeOver(active, over)}.`;
    },
    onDragEnd({ active, over }) {
      if (!over) {
        return `${describeActive(active)} dropped outside the calendar. No change made.`;
      }
      const conflicts = getConflicts(active, over);
      if (hasBlockingConflict(conflicts)) {
        return `Can't drop ${describeActive(active)} here: ${conflicts.map(describeConflict).join(", ")}. Nothing changed.`;
      }
      return `${describeActive(active)} dropped ${describeOver(active, over)}`;
    },
    onDragCancel({ active }) {
      return `Cancelled moving ${describeActive(active)}. Nothing changed.`;
    },
  };
}

export const dragScreenReaderInstructions = {
  draggable:
    "Press space or enter to pick up this shift or employee. While dragging, use the arrow keys to move between days and time slots. Press space or enter again to drop, or escape to cancel.",
};
