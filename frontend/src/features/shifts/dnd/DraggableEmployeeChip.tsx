import { useDraggable } from "@dnd-kit/core";
import type { Employee } from "@shiftly/shared";

// Palette access lives in a separate always-rendered button in
// EmployeeRoster — this component only needs to exist when dragging is
// actually available (mouse or dnd-kit's keyboard sensor), not on touch.
export function DraggableEmployeeChip({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `employee:${employee.id}`,
    data: { type: "employee" as const, employee },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      aria-label={`${employee.name}. Press space to pick up, then use arrow keys to choose a day and time, then space to create a shift there.`}
      className={`cursor-grab rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {employee.name}
    </button>
  );
}
