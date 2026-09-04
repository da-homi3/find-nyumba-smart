import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/hooks/use-auth";
import { buildPageHead } from "@/lib/seo/head";
import {
  listMyViewings,
  updateViewingStatus,
  type ViewingListItem,
} from "@/lib/api/booking.functions";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/tenant/viewings")({
  head: () =>
    buildPageHead({
      title: "My viewings — NyumbaSearch",
      description: "Track property viewings you have booked on NyumbaSearch.",
      path: "/tenant/viewings",
      noIndex: true,
    }),
  component: TenantViewingsPage,
});

function viewingStatusBadgeClass(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-primary/15 text-primary";
    case "completed":
      return "bg-muted text-muted-foreground";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
}

function TenantViewingsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const { data: viewings = [], isLoading } = useQuery({
    queryKey: ["my-viewings"],
    enabled: !!user,
    queryFn: () => listMyViewings(),
  });

  const cancel = useMutation({
    mutationFn: (viewingId: string) =>
      updateViewingStatus({ data: { viewingId, status: "cancelled" } }),
    onSuccess: () => {
      toast.success("Viewing cancelled");
      void qc.invalidateQueries({ queryKey: ["my-viewings"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const upcoming = viewings.filter((v) => v.status === "pending" || v.status === "confirmed");
  const past = viewings.filter((v) => v.status === "completed" || v.status === "cancelled");

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <SiteNav />
      <main id="main-content" className="mx-auto max-w-2xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">My viewings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upcoming and past property visits you booked.
            </p>
          </div>
          <div className="flex gap-3 text-xs font-semibold">
            <Link to="/tenant/applications" className="text-primary hover:underline">
              Applications
            </Link>
            <Link to="/tenant" className="text-primary hover:underline">
              Browse homes
            </Link>
          </div>
        </div>

        {loading || isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : !user ? (
          <p className="mt-8 text-sm text-muted-foreground">
            <Link to="/auth" search={{ mode: "signin", redirect: "/tenant/viewings" }} className="font-semibold text-primary underline">
              Sign in
            </Link>{" "}
            to see your viewings.
          </p>
        ) : viewings.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No viewings yet. Open a listing and book a visit with the landlord.
            </p>
            <Link
              to="/tenant"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Browse homes
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <ViewingGroup
              title="Upcoming"
              items={upcoming}
              empty="No upcoming viewings."
              onCancel={(id) => cancel.mutate(id)}
              cancelling={cancel.isPending}
            />
            <ViewingGroup
              title="Past"
              items={past}
              empty="No past viewings yet."
              onCancel={undefined}
              cancelling={false}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ViewingGroup({
  title,
  items,
  empty,
  onCancel,
  cancelling,
}: Readonly<{
  title: string;
  items: ViewingListItem[];
  empty: string;
  onCancel?: (id: string) => void;
  cancelling: boolean;
}>) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((v) => (
            <li key={v.id} className="rounded-2xl border bg-card p-4">
              <div className="flex justify-between gap-3">
                <div>
                  {v.property_id ? (
                    <Link
                      to="/tenant/property/$id"
                      params={{ id: v.property_id }}
                      className="text-sm font-semibold hover:text-primary"
                    >
                      {v.properties?.title ?? "Listing"}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold">{v.properties?.title ?? "Listing"}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(v.scheduled_at).toLocaleString()}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${viewingStatusBadgeClass(v.status)}`}
                  >
                    {v.status.toUpperCase()}
                  </span>
                </div>
                {onCancel && v.status === "pending" ? (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => onCancel(v.id)}
                    className="h-fit rounded-lg border border-destructive/30 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
