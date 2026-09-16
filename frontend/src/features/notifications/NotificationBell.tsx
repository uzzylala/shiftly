import { useState } from "react";
import { useNotificationStream } from "../../lib/sse";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "./use-notifications";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Every push gets spoken through this live region, independent of
  // whether the dropdown is open — a screen reader user should hear about
  // a new swap request the moment it arrives, not only after opening the bell.
  useNotificationStream((notification) => {
    setAnnouncement(notification.message);
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <span className="text-sm font-semibold text-slate-900">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">
                Nothing yet.
              </li>
            )}
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`border-b border-slate-50 px-4 py-3 text-sm last:border-b-0 ${
                  n.readAt ? "text-slate-500" : "bg-indigo-50/60 text-slate-900"
                }`}
              >
                <button
                  onClick={() => !n.readAt && markRead.mutate(n.id)}
                  className="block w-full text-left"
                >
                  <p>{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {timeFormatter.format(new Date(n.createdAt))}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
