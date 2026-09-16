import { useDroppable } from "@dnd-kit/core";
import { slotId } from "./grid";

interface DroppableSlotProps {
  dayIndex: number;
  slotIndex: number;
  heightPx: number;
  isConflicting: boolean;
}

export function DroppableSlot({
  dayIndex,
  slotIndex,
  heightPx,
  isConflicting,
}: DroppableSlotProps) {
  const id = slotId(dayIndex, slotIndex);
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ height: heightPx }}
      className={
        isOver
          ? isConflicting
            ? "border-t border-slate-100 bg-red-100"
            : "border-t border-slate-100 bg-indigo-100"
          : "border-t border-slate-100"
      }
    />
  );
}
