import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — NyumbaSearch" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["notifications-inbox", user?.id],
    enabled: Boolean(user),
    queryFn: () => listNotifications({ data: { limit: 50 } }),
  });

  const countQ = useQuery({
    queryKey: ["notifications-unread", user?.id],
    enabled: Boolean(user),
    queryFn: () => getUnreadNotificationCount(),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-inbox"] });
      qc.invalidateQueries({ queryKey: ["notifications-preview"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      toast.success("All marked read");
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-inbox"] });
      qc.invalidateQueries({ queryKey: ["notifications-preview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to see your updates.</p>
        <Link to="/auth" className="mt-4 inline-block text-sm font-semibold text-primary">
          Sign in →
        </Link>
      </div>
    );
  }

  const rows = listQ.data ?? [];
  const unread = countQ.data?.count ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Notifications</h1>
        </div>
        <button
          type="button"
          disabled={unread === 0 || markAll.isPending}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          onClick={() => markAll.mutate()}
        >
          Mark all read
        </button>
      </div>

      {listQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!listQ.isLoading && rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No notifications yet. We&apos;ll ping you about listings, messages, and account updates.
        </p>
      ) : null}

      <ul className="mt-6 space-y-2">
        {rows.map((n) => {
          const href = n.href?.startsWith("/") ? n.href : null;
          const content = (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-snug">{n.title}</p>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString("en-KE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
            </>
          );
          return (
            <li
              key={n.id}
              className={cn(
                "rounded-2xl border p-4 shadow-soft",
                n.readAt ? "bg-card" : "border-primary/30 bg-primary/5",
              )}
            >
              {href ? (
                <a
                  href={href}
                  className="block"
                  onClick={() => {
                    if (!n.readAt) markOne.mutate(n.id);
                  }}
                >
                  {content}
                </a>
              ) : (
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    if (!n.readAt) markOne.mutate(n.id);
                  }}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
