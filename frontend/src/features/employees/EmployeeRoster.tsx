import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createEmployeeSchema, type CreateEmployeeInput, type Employee } from "@shiftly/shared";
import { DraggableEmployeeChip } from "../shifts/dnd/DraggableEmployeeChip";
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
} from "./use-employees";

interface EmployeeRosterProps {
  // Renders each row as a draggable chip that can be dropped onto the
  // calendar to create a shift, plus a keyboard/touch "New shift…" trigger.
  dragEnabled?: boolean;
  onOpenPalette?: (employee: Employee) => void;
}

export function EmployeeRoster({ dragEnabled = false, onOpenPalette }: EmployeeRosterProps) {
  const { data: employees = [], isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const [grantLogin, setGrantLogin] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
  });

  const submit = handleSubmit((values) => {
    createEmployee.mutate(
      grantLogin ? values : { name: values.name },
      {
        onSuccess: () => {
          reset();
          setGrantLogin(false);
        },
      },
    );
  });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Roster</h2>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Employee name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={createEmployee.isPending}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {createEmployee.isPending ? "Adding..." : "Add"}
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={grantLogin}
            onChange={(e) => setGrantLogin(e.target.checked)}
          />
          Grant login access
        </label>

        {grantLogin && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="email"
                placeholder="Login email"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div>
              <input
                type="password"
                placeholder="Temporary password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>
        )}
        {createEmployee.isError && (
          <p className="text-sm text-red-600">{createEmployee.error.message}</p>
        )}
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading roster...</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {employees.map((employee) => (
            <li
              key={employee.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                {dragEnabled ? (
                  <DraggableEmployeeChip employee={employee} />
                ) : (
                  <span className="text-slate-800">{employee.name}</span>
                )}
                {onOpenPalette && (
                  <button
                    type="button"
                    onClick={() => onOpenPalette(employee)}
                    className="rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                    aria-label={`New shift for ${employee.name} via slot picker`}
                  >
                    New shift…
                  </button>
                )}
                {employee.hasLogin && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    Has login
                  </span>
                )}
              </div>
              <button
                onClick={() => deleteEmployee.mutate(employee.id)}
                disabled={deleteEmployee.isPending && deleteEmployee.variables === employee.id}
                className="shrink-0 text-red-600 hover:text-red-800 disabled:opacity-60"
              >
                {deleteEmployee.isPending && deleteEmployee.variables === employee.id
                  ? "Removing..."
                  : "Remove"}
              </button>
            </li>
          ))}
          {employees.length === 0 && (
            <li className="py-2 text-sm text-slate-500">
              No employees yet — add one to start scheduling.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
