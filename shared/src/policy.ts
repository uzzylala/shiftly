import type { AuthUser, Role } from "./types.js";

/**
 * Single source of truth for "who can do what". Imported by both the
 * backend (enforcement) and the frontend (what to render) so the two never
 * drift apart — there is only one copy of the rule.
 */
export type Action =
  | "shift:viewAll"
  | "shift:create"
  | "shift:update"
  | "shift:delete"
  | "availability:viewAll"
  | "availability:submit"
  | "employee:manage"
  | "employee:view"
  | "auditLog:view"
  | "swap:request"
  | "swap:decide";

const POLICY: Record<Role, Partial<Record<Action, true>>> = {
  manager: {
    "shift:viewAll": true,
    "shift:create": true,
    "shift:update": true,
    "shift:delete": true,
    "availability:viewAll": true,
    "employee:manage": true,
    "employee:view": true,
    "swap:decide": true,
  },
  hr: {
    "shift:viewAll": true,
    "availability:viewAll": true,
    "employee:view": true,
    "auditLog:view": true,
  },
  employee: {
    "availability:submit": true,
    "swap:request": true,
    // Employees need coworker names to pick who to request a swap with —
    // this is the same roster list managers/HR see, not a new endpoint.
    "employee:view": true,
  },
};

export function can(user: AuthUser, action: Action): boolean {
  return Boolean(POLICY[user.role]?.[action]);
}

// Ownership is resource-scoped, not a flat permission — a manager/HR user
// can view any shift, an employee only their own.
export function canViewShift(
  user: AuthUser,
  shift: { employeeId: string },
): boolean {
  if (can(user, "shift:viewAll")) return true;
  return user.role === "employee" && user.employeeId === shift.employeeId;
}

export function canViewAvailability(
  user: AuthUser,
  employeeId: string,
): boolean {
  if (can(user, "availability:viewAll")) return true;
  return user.role === "employee" && user.employeeId === employeeId;
}
