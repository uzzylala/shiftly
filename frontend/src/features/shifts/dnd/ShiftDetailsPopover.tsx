import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  DURATION_OPTIONS,
  shiftDetailsSchema,
  type ShiftDetailsValues,
} from "./shift-details-schema";

const startFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

interface ShiftDetailsPopoverProps {
  title: string;
  startTime: string;
  defaults?: Partial<ShiftDetailsValues>;
  onConfirm: (values: ShiftDetailsValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  pendingLabel?: string;
  errorMessage?: string;
  // Only present when editing an existing shift — the day/time picker
  // lives in the command palette, not here, so this hands off to it rather
  // than duplicating slot-selection UI inside the details form.
  onRequestMove?: () => void;
}

export function ShiftDetailsPopover({
  title,
  startTime,
  defaults,
  onConfirm,
  onCancel,
  isSubmitting,
  pendingLabel = "Saving...",
  errorMessage,
  onRequestMove,
}: ShiftDetailsPopoverProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShiftDetailsValues>({
    resolver: zodResolver(shiftDetailsSchema),
    defaultValues: {
      durationMinutes: 240,
      location: "",
      status: "scheduled",
      note: "",
      ...defaults,
    },
  });

  const submit = handleSubmit(onConfirm);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-24"
      onClick={onCancel}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Starts {startFormatter.format(new Date(startTime))}
          </p>
          {onRequestMove && (
            <button
              type="button"
              onClick={onRequestMove}
              className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Move to a different time…
            </button>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Duration</label>
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            {...register("durationMinutes", { valueAsNumber: true })}
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.minutes} value={opt.minutes}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Location</label>
          <input
            type="text"
            autoFocus
            placeholder="e.g. Front counter"
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            {...register("location")}
          />
          {errors.location && (
            <p className="text-xs text-red-600">{errors.location.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Status</label>
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            {...register("status")}
          >
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Note (optional)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            {...register("note")}
          />
        </div>

        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSubmitting ? pendingLabel : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
