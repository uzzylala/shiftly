import type { AuthUser, SwapRequest, SwapStatus } from "./types.js";

/**
 * The swap-request lifecycle from the Phase 4 design note, as data instead
 * of prose: every human-triggered transition the API will accept, in one
 * table, so a route handler asks this table "is that legal?" instead of
 * hand-rolling an if-chain that can drift from the diagram.
 *
 * `approved_by_manager -> finalized` / `finalize_failed` is deliberately
 * absent here — it's a system-triggered transition the server performs
 * automatically inside the "approve" handler, not something a client calls.
 */
export type SwapAction = "accept" | "decline" | "cancel" | "approve" | "reject";

export type SwapActor = "requester" | "coworker" | "manager";

interface SwapTransition {
  from: SwapStatus;
  action: SwapAction;
  to: SwapStatus;
  // Who is allowed to trigger it. "requester" / "coworker" are checked
  // against the swap's own requesterId/coworkerId, not just role.
  actors: SwapActor[];
}

export const SWAP_TRANSITIONS: SwapTransition[] = [
  { from: "requested", action: "accept", to: "accepted_by_coworker", actors: ["coworker"] },
  { from: "requested", action: "decline", to: "declined_by_coworker", actors: ["coworker"] },
  { from: "requested", action: "cancel", to: "cancelled", actors: ["requester"] },
  { from: "accepted_by_coworker", action: "cancel", to: "cancelled", actors: ["requester", "coworker"] },
  { from: "accepted_by_coworker", action: "reject", to: "rejected_by_manager", actors: ["manager"] },
  { from: "accepted_by_coworker", action: "approve", to: "approved_by_manager", actors: ["manager"] },
];

export const TERMINAL_SWAP_STATUSES: SwapStatus[] = [
  "declined_by_coworker",
  "cancelled",
  "rejected_by_manager",
  "finalized",
  "finalize_failed",
];

export function isTerminalSwapStatus(status: SwapStatus): boolean {
  return TERMINAL_SWAP_STATUSES.includes(status);
}

export function findSwapTransition(
  from: SwapStatus,
  action: SwapAction,
): SwapTransition | undefined {
  return SWAP_TRANSITIONS.find((t) => t.from === from && t.action === action);
}

// Which actions are even worth showing as buttons for this actor, given the
// swap's current status — used by both the manager queue and the employee's
// swap list so the UI never offers a button the backend would reject.
export function availableSwapActions(
  status: SwapStatus,
  actor: SwapActor,
): SwapAction[] {
  return SWAP_TRANSITIONS.filter(
    (t) => t.from === status && t.actors.includes(actor),
  ).map((t) => t.action);
}

// A user can hold more than one relationship to the same swap (a manager
// could in principle also be its coworker in a tiny org), so this returns
// every role that applies rather than picking one.
export function swapActorsFor(
  user: AuthUser,
  swap: Pick<SwapRequest, "requesterId" | "coworkerId">,
): SwapActor[] {
  const actors: SwapActor[] = [];
  if (user.role === "manager") actors.push("manager");
  if (user.employeeId === swap.requesterId) actors.push("requester");
  if (user.employeeId === swap.coworkerId) actors.push("coworker");
  return actors;
}

export function canPerformSwapAction(
  user: AuthUser,
  swap: Pick<SwapRequest, "requesterId" | "coworkerId" | "status">,
  action: SwapAction,
): boolean {
  const transition = findSwapTransition(swap.status, action);
  if (!transition) return false;
  const myActors = swapActorsFor(user, swap);
  return transition.actors.some((required) => myActors.includes(required));
}
