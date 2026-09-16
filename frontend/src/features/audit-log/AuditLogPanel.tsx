import { Fragment } from "react";
import type { AuditLogEntry, Employee } from "@shiftly/shared";
import { useAuditLog } from "./use-audit-log";

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const FIELDS: Array<{ key: keyof NonNullable<AuditLogEntry["before"]>; label: string }> = [
  { key: "startTime", label: "Start" },
  { key: "endTime", label: "End" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
  { key: "note", label: "Note" },
];

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "startTime" || key === "endTime") {
    return new Date(value as string).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return String(value);
}

function Diff({ entry }: { entry: AuditLogEntry }) {
  if (entry.action === "created") {
    return (
      <dl className="grid grid-cols-[80px_1fr] gap-1 text-xs text-slate-600">
        {FIELDS.map(({ key, label }) => (
          <Fragment key={key}>
            <dt className="font-medium text-slate-500">{label}</dt>
            <dd>{formatValue(key, entry.after?.[key])}</dd>
          </Fragment>
        ))}
      </dl>
    );
  }

  if (entry.action === "deleted") {
    return (
      <dl className="grid grid-cols-[80px_1fr] gap-1 text-xs text-slate-600">
        {FIELDS.map(({ key, label }) => (
          <Fragment key={key}>
            <dt className="font-medium text-slate-500">{label}</dt>
            <dd>{formatValue(key, entry.before?.[key])}</dd>
          </Fragment>
        ))}
      </dl>
    );
  }

  const changed = FIELDS.filter(
    ({ key }) => entry.before?.[key] !== entry.after?.[key],
  );
  if (changed.length === 0) {
    return <p className="text-xs text-slate-500">No field-level changes recorded.</p>;
  }
  return (
    <dl className="grid grid-cols-[80px_1fr] gap-1 text-xs text-slate-600">
      {changed.map(({ key, label }) => (
        <Fragment key={key}>
          <dt className="font-medium text-slate-500">{label}</dt>
          <dd>
            <span className="text-slate-400 line-through">
              {formatValue(key, entry.before?.[key])}
            </span>{" "}
            → {formatValue(key, entry.after?.[key])}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function AuditLogPanel({ employees }: { employees: Employee[] }) {
  const { data: entries = [], isLoading, isError } = useAuditLog();
  const employeesById = new Map(employees.map((e) => [e.id, e]));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        Schedule change history
      </h2>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading audit log...</p>
      ) : isError ? (
        <p className="text-sm text-red-600">Couldn't load the audit log.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No schedule changes recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const employeeId = entry.after?.employeeId ?? entry.before?.employeeId;
            const employeeName = employeeId
              ? employeesById.get(employeeId)?.name ?? "Unknown employee"
              : "Unknown employee";

            return (
              <li key={entry.id} className="rounded-lg border border-slate-100 p-3">
                <details>
                  <summary className="cursor-pointer text-sm text-slate-700">
                    <span className="font-medium">{entry.actorName}</span>{" "}
                    {entry.action} a shift for{" "}
                    <span className="font-medium">{employeeName}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {timestampFormatter.format(new Date(entry.createdAt))}
                    </span>
                  </summary>
                  <div className="mt-2">
                    <Diff entry={entry} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
