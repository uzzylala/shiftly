import { useDraggable } from "@dnd-kit/core";
import type { Shift, ShiftStatus } from "@shiftly/shared";

export const STATUS_STYLES: Record<ShiftStatus, string> = {
  scheduled: "bg-indigo-100 border-indigo-300 text-indigo-900",
  completed: "bg-emerald-100 border-emerald-300 text-emerald-900",
  cancelled: "bg-slate-100 border-slate-300 text-slate-500 line-through",
};

interface DraggableShiftTileProps {
  shift: Shift;
  employeeName: string;
  timeLabel: string;
  top: number;
  height: number;
  onSelect: () => void;
  onDelete: () => void;
}

// setNodeRef stays on the outer tile (what dnd-kit measures and positions);
// listeners/attributes go on the inner button only — the "drag handle"
// pattern, so the delete button beside it can be a normal sibling click
// that never triggers a drag pickup.
export function DraggableShiftTile({
  shift,
  employeeName,
  timeLabel,
  top,
  height,
  onSelect,
  onDelete,
}: DraggableShiftTileProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `shift:${shift.id}`,
    data: { type: "shift" as const, shift },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ top, height, opacity: isDragging ? 0.35 : 1 }}
      className={`absolute left-1 right-1 overflow-hidden rounded-md border text-[11px] leading-tight shadow-sm ${STATUS_STYLES[shift.status]}`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={onSelect}
        aria-label={`${employeeName} shift, ${timeLabel}, ${shift.location}, ${shift.status}. Press space to pick up and move with arrow keys, or activate to edit details.`}
        className="block h-full w-full cursor-grab px-2 py-1 pr-5 text-left active:cursor-grabbing"
      >
        <div className="truncate font-semibold">{employeeName}</div>
        <div className="truncate">{timeLabel}</div>
        <div className="truncate opacity-80">{shift.location}</div>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${employeeName}'s ${timeLabel} shift`}
        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[11px] leading-none text-red-600 hover:bg-white"
      >
        ×
      </button>
    </div>
  );
}
