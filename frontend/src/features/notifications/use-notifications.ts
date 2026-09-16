import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@shiftly/shared";
import { apiFetch } from "../../lib/api-client";

const NOTIFICATIONS_KEY = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => apiFetch<Notification[]>("/notifications"),
    // The SSE-driven backstop from the Phase 4 design note: catches
    // whatever the stream missed while the tab was backgrounded or asleep.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Notification>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
