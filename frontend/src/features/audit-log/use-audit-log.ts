import { useQuery } from "@tanstack/react-query";
import type { AuditLogEntry } from "@shiftly/shared";
import { apiFetch } from "../../lib/api-client";

export function useAuditLog(shiftId?: string) {
  return useQuery({
    queryKey: ["audit-log", shiftId ?? "all"],
    queryFn: () =>
      apiFetch<AuditLogEntry[]>(
        shiftId ? `/audit-log?shiftId=${encodeURIComponent(shiftId)}` : "/audit-log",
      ),
  });
}
