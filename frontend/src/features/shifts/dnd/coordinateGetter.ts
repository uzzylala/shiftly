import { KeyboardCode, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { DAY_COUNT, SLOTS_PER_DAY, slotId } from "./grid";

/**
 * dnd-kit's default keyboard coordinate getter nudges by a fixed pixel
 * delta, which means nothing on a calendar grid — this one moves by grid
 * cells instead: Left/Right change the day, Up/Down change the half-hour
 * slot, and the result is the target cell's own center point, so dnd-kit's
 * normal collision detection resolves `over` to that exact droppable on
 * the next render (same pipeline a pointer drag uses).
 *
 * `getCurrentSlot` reads a ref that's updated from onDragOver, so keyboard
 * movement always continues from wherever the drag currently is — pointer
 * and keyboard share one source of truth for "where is this drag right now".
 */
export function createGridCoordinateGetter(
  getCurrentSlot: () => { dayIndex: number; slotIndex: number } | null,
): KeyboardCoordinateGetter {
  return (event, { context }) => {
    const arrowCodes: string[] = [
      KeyboardCode.Up,
      KeyboardCode.Down,
      KeyboardCode.Left,
      KeyboardCode.Right,
    ];
    if (!arrowCodes.includes(event.code)) return undefined;

    const current = getCurrentSlot();
    if (!current) return undefined;

    event.preventDefault();

    let { dayIndex, slotIndex } = current;
    switch (event.code) {
      case KeyboardCode.Left:
        dayIndex = Math.max(0, dayIndex - 1);
        break;
      case KeyboardCode.Right:
        dayIndex = Math.min(DAY_COUNT - 1, dayIndex + 1);
        break;
      case KeyboardCode.Up:
        slotIndex = Math.max(0, slotIndex - 1);
        break;
      case KeyboardCode.Down:
        slotIndex = Math.min(SLOTS_PER_DAY - 1, slotIndex + 1);
        break;
    }

    const targetId = slotId(dayIndex, slotIndex);
    const rect = context.droppableRects.get(targetId);
    if (!rect) return undefined;

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };
}
