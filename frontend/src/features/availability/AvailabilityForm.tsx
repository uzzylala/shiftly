import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  createAvailabilityWindowSchema,
  type CreateAvailabilityWindowInput,
} from "@shiftly/shared";
import {
  useAvailability,
  useCreateAvailabilityWindow,
  useDeleteAvailabilityWindow,
} from "./use-availability";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FormValues = Omit<CreateAvailabilityWindowInput, "employeeId">;

export function AvailabilityForm({ employeeId }: { employeeId: string }) {
  const { data: windows = [], isLoading } = useAvailability(employeeId);
  const createWindow = useCreateAvailabilityWindow();
  const deleteWindow = useDeleteAvailabilityWindow();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createAvailabilityWindowSchema),
    defaultValues: { dayOfWeek: 0, startTime: "09:00", endTime: "17:00" },
  });

  const submit = handleSubmit((values) => {
    createWindow.mutate(values, {
      onSuccess: () => reset({ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" }),
    });
  });

  const windowsByDay = DAY_LABELS.map((label, dayOfWeek) => ({
    label,
    dayOfWeek,
    windows: windows.filter((w) => w.dayOfWeek === dayOfWeek),
  }));

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        My weekly availability
      </h2>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Day</label>
          <select
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            {...register("dayOfWeek", { valueAsNumber: true })}
          >
            {DAY_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">From</label>
          <input
            type="time"
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            {...register("startTime")}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">To</label>
          <input
            type="time"
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            {...register("endTime")}
          />
        </div>
        <button
          type="submit"
          disabled={createWindow.isPending}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {createWindow.isPending ? "Adding..." : "Add"}
        </button>
        {errors.endTime && (
          <p className="w-full text-sm text-red-600">{errors.endTime.message}</p>
        )}
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading availability...</p>
      ) : (
        <ul className="space-y-2">
          {windowsByDay.map((day) => (
            <li key={day.label} className="flex items-start gap-3 text-sm">
              <span className="w-10 shrink-0 font-medium text-slate-700">
                {day.label}
              </span>
              {day.windows.length === 0 ? (
                <span className="text-slate-400">Not available</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {day.windows.map((window) => (
                    <span
                      key={window.id}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                    >
                      {window.startTime}–{window.endTime}
                      <button
                        onClick={() => deleteWindow.mutate(window.id)}
                        className="text-indigo-400 hover:text-indigo-700"
                        aria-label={`Remove ${day.label} ${window.startTime}-${window.endTime}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
