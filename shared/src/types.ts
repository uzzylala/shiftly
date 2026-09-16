/**
 * Types shared between frontend and backend. Kept as the single source of
 * truth for API contracts so the two sides can never silently drift apart.
 */

export type Role = "manager" | "employee" | "hr";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  // Set only for role "employee" — the roster Employee record this login is
  // linked to. Every "own shifts/availability only" policy check scopes on
  // this, not on the login's user id.
  employeeId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface Employee {
  id: string;
  organizationId: string;
  name: string;
  hasLogin: boolean;
  createdAt: string;
}

export type ShiftStatus = "scheduled" | "completed" | "cancelled";

export interface Shift {
  id: string;
  organizationId: string;
  employeeId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  location: string;
  status: ShiftStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftInput {
  employeeId: string;
  startTime: string;
  endTime: string;
  location: string;
  status?: ShiftStatus;
  note?: string;
}

export type UpdateShiftInput = Partial<CreateShiftInput>;

export interface CreateEmployeeInput {
  name: string;
  // Optional: manager sets these to grant the employee a login in the same
  // step as adding them to the roster. Omit to keep the employee roster-only.
  email?: string;
  password?: string;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

// Mon=0 .. Sun=6, matching the calendar's week-start convention.
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AvailabilityWindow {
  id: string;
  employeeId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  createdAt: string;
}

export interface CreateAvailabilityWindowInput {
  employeeId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export type AuditAction = "created" | "updated" | "deleted";

export interface AuditLogEntry {
  id: string;
  shiftId: string;
  actorUserId: string;
  actorName: string;
  action: AuditAction;
  before: Shift | null;
  after: Shift | null;
  createdAt: string;
}

export type ConflictReason =
  | { type: "double_booked"; conflictingShiftId: string }
  | { type: "outside_availability" }
  | { type: "no_availability_submitted" };

export interface ApiErrorBody {
  message: string;
  details?: Record<string, string[]>;
  conflicts?: ConflictReason[];
}

// See shared/src/swap-state-machine.ts for the transition table this
// enum's values are driven by.
export type SwapStatus =
  | "requested"
  | "accepted_by_coworker"
  | "declined_by_coworker"
  | "cancelled"
  | "rejected_by_manager"
  | "approved_by_manager"
  | "finalized"
  | "finalize_failed";

export interface SwapRequest {
  id: string;
  organizationId: string;
  // Nullable: SetNull on the referenced shift's deletion, so a pending
  // request survives the shift going away instead of vanishing — the
  // accept/approve guards check for null here to explain why a stale
  // request can no longer proceed.
  shiftId: string | null;
  requesterId: string;
  coworkerId: string;
  status: SwapStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSwapRequestInput {
  shiftId: string;
  coworkerId: string;
}

export type NotificationType =
  | "swap:requested"
  | "swap:accepted"
  | "swap:declined"
  | "swap:cancelled"
  | "swap:approved"
  | "swap:rejected"
  | "swap:finalized"
  | "swap:finalize_failed"
  | "shift:changed";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  swapRequestId: string | null;
  shiftId: string | null;
  readAt: string | null;
  createdAt: string;
}

// SSE payload pushed over the wire — a thin envelope around a Notification
// so the client can invalidate the right query keys without re-deriving
// what changed from the message text.
export interface SseNotificationEvent {
  notification: Notification;
}
