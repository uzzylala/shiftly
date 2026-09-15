import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { Employee, Shift } from "@shiftly/shared";
import { shiftFormSchema, type ShiftFormValues } from "./shift-form-schema";

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface ShiftFormProps {
  employees: Employee[];
  editingShift: Shift | null;
  onSubmit: (values: ShiftFormValues) => void;
  onCancelEdit: () => void;
  isSubmitting: boolean;
}

export function ShiftForm({
  employees,
  editingShift,
  onSubmit,
  onCancelEdit,
  isSubmitting,
}: ShiftFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShiftFormValues>({ resolver: zodResolver(shiftFormSchema) });

  useEffect(() => {
    if (editingShift) {
      reset({
        employeeId: editingShift.employeeId,
        startTime: toLocalInputValue(editingShift.startTime),
        endTime: toLocalInputValue(editingShift.endTime),
        note: editingShift.note ?? "",
      });
    } else {
      reset({ employeeId: "", startTime: "", endTime: "", note: "" });
    }
  }, [editingShift, reset]);

  const submit = handleSubmit((values) => {
    onSubmit(values);
    if (!editingShift) {
      reset({ employeeId: "", startTime: "", endTime: "", note: "" });
    }
  });

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-slate-900">
        {editingShift ? "Edit shift" : "Add shift"}
      </h2>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Employee</label>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("employeeId")}
        >
          <option value="">Select an employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        {errors.employeeId && (
          <p className="text-sm text-red-600">{errors.employeeId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Start</label>
          <input
            type="datetime-local"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("startTime")}
          />
          {errors.startTime && (
            <p className="text-sm text-red-600">{errors.startTime.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">End</label>
          <input
            type="datetime-local"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("endTime")}
          />
          {errors.endTime && (
            <p className="text-sm text-red-600">{errors.endTime.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">
          Note (optional)
        </label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("note")}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {editingShift ? "Save changes" : "Add shift"}
        </button>
        {editingShift && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
