import { useMemo, useState, type FormEvent } from "react";
import {
  availableSwapActions,
  swapActorsFor,
  type Employee,
  type Shift,
  type SwapStatus,
} from "@shiftly/shared";
import { useAuthStore } from "../../store/auth-store";
import { usePermission } from "../../lib/policy";
import {
  useAcceptSwap,
  useApproveSwap,
  useCancelSwap,
  useCreateSwapRequest,
  useDeclineSwap,
  useRejectSwap,
  useSwapRequests,
} from "./use-swap-requests";

const STATUS_LABELS: Record<SwapStatus, string> = {
  requested: "Awaiting coworker",
  accepted_by_coworker: "Awaiting manager approval",
  declined_by_coworker: "Declined",
  cancelled: "Cancelled",
  rejected_by_manager: "Rejected by manager",
  approved_by_manager: "Approved",
  finalized: "Finalized",
  finalize_failed: "Couldn't be finalized",
};

const shiftFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

interface SwapRequestPanelProps {
  shifts: Shift[];
  employees: Employee[];
}

export function SwapRequestPanel({ shifts, employees }: SwapRequestPanelProps) {
  const user = useAuthStore((s) => s.user)!;
  const canRequest = usePermission("swap:request");

  const { data: swaps = [], isLoading } = useSwapRequests();
  const createSwap = useCreateSwapRequest();
  const acceptSwap = useAcceptSwap();
  const declineSwap = useDeclineSwap();
  const cancelSwap = useCancelSwap();
  const approveSwap = useApproveSwap();
  const rejectSwap = useRejectSwap();

  const employeesById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );
  const shiftsById = useMemo(
    () => new Map(shifts.map((s) => [s.id, s])),
    [shifts],
  );

  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [selectedCoworkerId, setSelectedCoworkerId] = useState("");

  // shifts is whatever week the calendar currently has loaded, so this only
  // offers shifts from the visible week — switch weeks to offer a different one.
  const myOwnShifts = shifts.filter(
    (s) => s.employeeId === user.employeeId && s.status === "scheduled",
  );
  const coworkerOptions = employees.filter((e) => e.id !== user.employeeId);

  function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!selectedShiftId || !selectedCoworkerId) return;
    createSwap.mutate(
      { shiftId: selectedShiftId, coworkerId: selectedCoworkerId },
      {
        onSuccess: () => {
          setSelectedShiftId("");
          setSelectedCoworkerId("");
        },
      },
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Shift swaps</h2>

      {canRequest && (
        <form
          onSubmit={submitRequest}
          className="space-y-2 border-b border-slate-100 pb-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Your shift to offer
            </label>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Select a shift</option>
              {myOwnShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {shiftFormatter.format(new Date(s.startTime))} — {s.location}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Swap with
            </label>
            <select
              value={selectedCoworkerId}
              onChange={(e) => setSelectedCoworkerId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Select a coworker</option>
              {coworkerOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={createSwap.isPending || !selectedShiftId || !selectedCoworkerId}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {createSwap.isPending ? "Requesting..." : "Request swap"}
          </button>
          {createSwap.isError && (
            <p className="text-sm text-red-600">{createSwap.error.message}</p>
          )}
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading swap requests...</p>
      ) : swaps.length === 0 ? (
        <p className="text-sm text-slate-500">No swap requests.</p>
      ) : (
        <ul className="space-y-3">
          {swaps.map((swap) => {
            const actors = swapActorsFor(user, swap);
            const actions = [
              ...new Set(
                actors.flatMap((actor) =>
                  availableSwapActions(swap.status, actor),
                ),
              ),
            ];
            const shift = swap.shiftId ? shiftsById.get(swap.shiftId) : undefined;
            const requesterName =
              employeesById.get(swap.requesterId)?.name ?? "Unknown";
            const coworkerName =
              employeesById.get(swap.coworkerId)?.name ?? "Unknown";

            return (
              <li
                key={swap.id}
                className="rounded-lg border border-slate-100 p-3 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {requesterName} → {coworkerName}
                </p>
                <p className="text-slate-500">
                  {shift
                    ? `${shiftFormatter.format(new Date(shift.startTime))} · ${shift.location}`
                    : swap.shiftId === null
                      ? "The referenced shift no longer exists"
                      : "Shift details not loaded — switch to that week to see them"}
                </p>
                <p className="mt-1 text-xs font-medium text-indigo-700">
                  {STATUS_LABELS[swap.status]}
                </p>

                {actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {actions.includes("accept") && (
                      <button
                        onClick={() => acceptSwap.mutate(swap.id)}
                        disabled={acceptSwap.isPending && acceptSwap.variables === swap.id}
                        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {acceptSwap.isPending && acceptSwap.variables === swap.id
                          ? "Accepting..."
                          : "Accept"}
                      </button>
                    )}
                    {actions.includes("decline") && (
                      <button
                        onClick={() => declineSwap.mutate(swap.id)}
                        disabled={declineSwap.isPending && declineSwap.variables === swap.id}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {declineSwap.isPending && declineSwap.variables === swap.id
                          ? "Declining..."
                          : "Decline"}
                      </button>
                    )}
                    {actions.includes("cancel") && (
                      <button
                        onClick={() => cancelSwap.mutate(swap.id)}
                        disabled={cancelSwap.isPending && cancelSwap.variables === swap.id}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {cancelSwap.isPending && cancelSwap.variables === swap.id
                          ? "Cancelling..."
                          : "Cancel"}
                      </button>
                    )}
                    {actions.includes("approve") && (
                      <button
                        onClick={() => approveSwap.mutate(swap.id)}
                        disabled={approveSwap.isPending && approveSwap.variables === swap.id}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {approveSwap.isPending && approveSwap.variables === swap.id
                          ? "Approving..."
                          : "Approve"}
                      </button>
                    )}
                    {actions.includes("reject") && (
                      <button
                        onClick={() => rejectSwap.mutate(swap.id)}
                        disabled={rejectSwap.isPending && rejectSwap.variables === swap.id}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {rejectSwap.isPending && rejectSwap.variables === swap.id
                          ? "Rejecting..."
                          : "Reject"}
                      </button>
                    )}
                  </div>
                )}
                {approveSwap.isError && approveSwap.variables === swap.id && (
                  <p className="mt-2 text-xs text-red-600">
                    {approveSwap.error.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
