import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createEmployeeSchema, type CreateEmployeeInput } from "@shiftly/shared";
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
} from "./use-employees";

export function EmployeeRoster() {
  const { data: employees = [], isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
  });

  const submit = handleSubmit((values) => {
    createEmployee.mutate(values, { onSuccess: () => reset() });
  });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Roster</h2>

      <form onSubmit={submit} className="flex gap-2">
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
          Add
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading roster...</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {employees.map((employee) => (
            <li
              key={employee.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-slate-800">{employee.name}</span>
              <button
                onClick={() => deleteEmployee.mutate(employee.id)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
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
