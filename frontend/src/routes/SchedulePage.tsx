import { useMemo, useState } from "react";
import type { Shift } from "@shiftly/shared";
import { EmployeeRoster } from "../features/employees/EmployeeRoster";
import { useEmployees } from "../features/employees/use-employees";
import { ShiftForm } from "../features/shifts/ShiftForm";
import { ShiftTable } from "../features/shifts/ShiftTable";
import type { ShiftFormValues } from "../features/shifts/shift-form-schema";
import {
  useCreateShift,
  useDeleteShift,
  useShifts,
  useUpdateShift,
} from "../features/shifts/use-shifts";
import { useAuthStore } from "../store/auth-store";

function toIso(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

export function SchedulePage() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const { data: employees = [] } = useEmployees();
  const { data: shifts = [], isLoading } = useShifts();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  function handleSubmit(values: ShiftFormValues) {
    const payload = {
      employeeId: values.employeeId,
      startTime: toIso(values.startTime),
      endTime: toIso(values.endTime),
      note: values.note || undefined,
    };

    if (editingShift) {
      updateShift.mutate(
        { id: editingShift.id, input: payload },
        { onSuccess: () => setEditingShift(null) },
      );
    } else {
      createShift.mutate(payload);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Weekly schedule
          </h1>
          <p className="text-sm text-slate-500">Signed in as {user?.name}</p>
        </div>
        <button
          onClick={clearSession}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <EmployeeRoster />
          <ShiftForm
            employees={employees}
            editingShift={editingShift}
            onSubmit={handleSubmit}
            onCancelEdit={() => setEditingShift(null)}
            isSubmitting={createShift.isPending || updateShift.isPending}
          />
        </div>

        <div className="lg:col-span-2">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading schedule...</p>
          ) : (
            <ShiftTable
              shifts={shifts}
              employeesById={employeesById}
              onEdit={setEditingShift}
              onDelete={(shift) => deleteShift.mutate(shift.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
