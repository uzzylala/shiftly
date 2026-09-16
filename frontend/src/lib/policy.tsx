import type { ReactNode } from "react";
import { can, type Action } from "@shiftly/shared";
import { useAuthStore } from "../store/auth-store";

// Same `can()` the backend enforces with — see @shiftly/shared/policy.
// This hook is purely "what to render"; it carries no authority of its own.
export function usePermission(action: Action): boolean {
  const user = useAuthStore((s) => s.user);
  return user ? can(user, action) : false;
}

export function Can({
  action,
  children,
}: {
  action: Action;
  children: ReactNode;
}) {
  return usePermission(action) ? <>{children}</> : null;
}
