import type { Employee, Shift } from "@shiftly/shared";

interface ShiftTableProps {
  shifts: Shift[];
  employeesById: Map<string, Employee>;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
}

const formatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function ShiftTable({
  shifts,
  employeesById,
  onEdit,
  onDelete,
}: ShiftTableProps) {
  if (shifts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No shifts scheduled yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Employee</th>
            <th className="px-4 py-3 font-medium">Start</th>
            <th className="px-4 py-3 font-medium">End</th>
            <th className="px-4 py-3 font-medium">Note</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {shifts.map((shift) => (
            <tr key={shift.id}>
              <td className="px-4 py-3 font-medium text-slate-900">
                {employeesById.get(shift.employeeId)?.name ?? "Unknown"}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatter.format(new Date(shift.startTime))}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatter.format(new Date(shift.endTime))}
              </td>
              <td className="px-4 py-3 text-slate-500">{shift.note ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(shift)}
                  className="mr-3 text-indigo-600 hover:text-indigo-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(shift)}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
