import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications.functions";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationBellMenu({
  className,
  bellClassName,
}: Readonly<{ className?: string; bellClassName?: string }>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const countQ = useQuery({
    queryKey: ["notifications-unread", user?.id],
    enabled: Boolean(user),
    queryFn: () => getUnreadNotificationCount(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const listQ = useQuery({
    queryKey: ["notifications-preview", user?.id],
    enabled: Boolean(user) && open,
    queryFn: () => listNotifications({ data: { limit: 8 } }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-preview"] });
      qc.invalidateQueries({ queryKey: ["notifications-inbox"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-preview"] });
      qc.invalidateQueries({ queryKey: ["notifications-inbox"] });
    },
  });

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  const unread = countQ.data?.count ?? 0;
  const rows = listQ.data ?? [];

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <NotificationBell
        unreadCount={unread}
        className={bellClassName}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-card shadow-elegant">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              type="button"
              className="text-[11px] font-semibold text-primary disabled:opacity-40"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {listQ.isLoading ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</li>
            ) : null}
            {!listQ.isLoading && rows.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                You&apos;re all caught up.
              </li>
            ) : null}
            {rows.map((n) => {
              const target = n.href?.startsWith("/") ? n.href : "/notifications";
              return (
                <li key={n.id} className="border-b border-border/50 last:border-0">
                  <a
                    href={target}
                    className={cn(
                      "block px-3 py-2.5 text-left transition hover:bg-secondary/60",
                      !n.readAt && "bg-primary/5",
                    )}
                    onClick={() => {
                      if (!n.readAt) markOne.mutate(n.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="border-t px-3 py-2">
            <Link
              to="/notifications"
              className="block text-center text-xs font-semibold text-primary"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
