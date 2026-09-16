import type { ApiErrorBody, AuthTokens, ConflictReason } from "@shiftly/shared";
import { useAuthStore } from "../store/auth-store";

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;
  conflicts?: ConflictReason[];

  constructor(
    status: number,
    message: string,
    details?: Record<string, string[]>,
    conflicts?: ConflictReason[],
  ) {
    super(message);
    this.status = status;
    this.details = details;
    this.conflicts = conflicts;
  }
}

async function refreshTokens(): Promise<AuthTokens | null> {
  const { tokens, user, setSession, clearSession } = useAuthStore.getState();
  if (!tokens || !user) return null;

  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    return null;
  }

  const newTokens = (await res.json()) as AuthTokens;
  setSession(user, newTokens);
  return newTokens;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const call = async (): Promise<Response> => {
    const { tokens } = useAuthStore.getState();
    return fetch(`/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        ...init.headers,
      },
    });
  };

  let res = await call();

  if (res.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await call();
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.message ?? "Request failed",
      body?.details,
      body?.conflicts,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
