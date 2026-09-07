"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "firebase/auth";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllRead,
  AppNotification,
  NotificationType,
} from "@/lib/notifications";

const ICON: Record<NotificationType, string> = {
  like: "♥",
  comment: "💬",
  reply: "↩",
  new_post: "📝",
  suspended: "⚠",
  unsuspended: "✓",
  appeal_rejected: "✕",
  role_changed: "🎖",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function NotificationBell({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = subscribeToNotifications(user.uid, setNotifications);
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleClick(n: AppNotification) {
    markNotificationRead(n.id).catch(() => {});
    setOpen(false);
    if (n.linkHref) router.push(n.linkHref);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink hover:text-crimson-bright"
      >
        <span className="text-lg leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-crimson px-1 font-mono text-[9px] font-bold text-paper">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl2 border border-rule bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-rule p-3">
            <p className="font-ui text-sm font-bold text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead(notifications).catch(() => {})}
                className="font-mono text-[10px] uppercase tracking-wideish text-crimson-bright hover:text-crimson"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate">
              Nothing yet — likes, comments, and follows show up here.
            </p>
          ) : (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-3 border-b border-rule p-3 text-left transition-colors last:border-b-0 hover:bg-paper ${
                    n.read ? "" : "bg-crimson/5"
                  }`}
                >
                  <span className="mt-0.5 text-base leading-none">{ICON[n.type]}</span>
                  <div className="flex-1">
                    <p className="text-sm text-ink">{n.message}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-crimson" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
