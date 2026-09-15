/**
 * Types shared between frontend and backend. Kept as the single source of
 * truth for API contracts so the two sides can never silently drift apart.
 */

// Only "manager" is issuable/creatable in the MVP phase. "employee" and "hr"
// are listed now so the `role` column/token claim shape doesn't need to
// change shape when RBAC (phase 2) adds them.
export type Role = "manager" | "employee" | "hr";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
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
  createdAt: string;
}

export interface Shift {
  id: string;
  organizationId: string;
  employeeId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftInput {
  employeeId: string;
  startTime: string;
  endTime: string;
  note?: string;
}

export type UpdateShiftInput = Partial<CreateShiftInput>;

export interface CreateEmployeeInput {
  name: string;
}

export interface ApiErrorBody {
  message: string;
  details?: Record<string, string[]>;
}
