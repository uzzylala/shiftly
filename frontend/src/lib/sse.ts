import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Notification, SseNotificationEvent } from "@shiftly/shared";
import { apiFetch } from "./api-client";
import { useAuthStore } from "../store/auth-store";

const RECONNECT_DELAY_MS = 2000;

/**
 * One persistent notification stream per signed-in session. Reconnection is
 * managed here, not left to EventSource's own retry — the stream ticket is
 * single-use (see events.routes.ts), so blindly letting the browser retry
 * the same URL after a drop would just resend an already-consumed ticket
 * forever. Every manual reconnect mints a fresh ticket and carries the last
 * seen event id itself, so replay works the same way whether the browser
 * or this hook initiated the reconnect.
 */
export function useNotificationStream(
  onNotification?: (notification: Notification) => void,
) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const lastSeqRef = useRef(0);
  const onNotificationRef = useRef(onNotification);
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      if (stopped) return;
      try {
        const { ticket } = await apiFetch<{ ticket: string }>(
          "/events/ticket",
          { method: "POST" },
        );
        if (stopped) return;

        const params = new URLSearchParams({ ticket });
        if (lastSeqRef.current > 0) {
          params.set("lastEventId", String(lastSeqRef.current));
        }
        const es = new EventSource(`/api/events/stream?${params.toString()}`);
        source = es;

        es.addEventListener("notification", (event) => {
          const messageEvent = event as MessageEvent<string>;
          const seq = Number(messageEvent.lastEventId);
          if (!Number.isNaN(seq)) lastSeqRef.current = seq;

          const payload = JSON.parse(messageEvent.data) as SseNotificationEvent;
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          if (payload.notification.type.startsWith("swap:")) {
            queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
          }
          if (payload.notification.shiftId) {
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
          }
          onNotificationRef.current?.(payload.notification);
        });

        es.onerror = () => {
          es.close();
          if (source === es) source = null;
          if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        };
      } catch {
        if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [user, queryClient]);
}
