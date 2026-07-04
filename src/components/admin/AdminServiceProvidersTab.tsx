import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { AdminAsyncPanel, type PendingServiceProvider } from "@/components/admin/admin-shared";

type Props = Readonly<{
  providers: PendingServiceProvider[];
  loading: boolean;
  review: UseMutationResult<
    unknown,
    Error,
    { providerId: string; action: "approve" | "reject"; rejectionReason?: string },
    unknown
  >;
}>;

export function AdminServiceProvidersTab({ providers, loading, review }: Props) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function confirmReject(providerId: string) {
    review.mutate({
      providerId,
      action: "reject",
      rejectionReason: rejectReason.trim() || undefined,
    });
    setRejectId(null);
    setRejectReason("");
  }

  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading service provider waitlist…"
      isEmpty={providers.length === 0}
      emptyContent={
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No service providers waiting for approval.
        </div>
      }
    >
      <div className="space-y-4">
        {providers.map((provider) => {
          const categories = Array.isArray(provider.categories)
            ? (provider.categories as string[]).join(", ")
            : "";
          const areas = Array.isArray(provider.areas_served)
            ? (provider.areas_served as string[]).join(", ")
            : "";
          return (
            <div
              key={provider.id}
              className="flex flex-wrap justify-between gap-4 rounded-2xl border bg-card p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{provider.business_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {provider.profiles?.full_name ?? "Applicant"}
                  {provider.email ? ` · ${provider.email}` : ""}
                  {" · "}
                  {provider.phone ?? provider.profiles?.phone ?? "No phone"}
                  {" · "}
                  {new Date(provider.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm capitalize text-muted-foreground">
                  {categories || "No categories"}
                  {areas ? ` · ${areas}` : ""}
                  {provider.tier ? ` · ${provider.tier} plan` : ""}
                </p>
                {provider.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {provider.description}
                  </p>
                )}
              </div>
              {rejectId === provider.id ? (
                <div className="flex w-full flex-col gap-2 sm:w-72">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Rejection reason (optional)
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      placeholder="e.g. incomplete business details"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmReject(provider.id)}
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectId(null);
                        setRejectReason("");
                      }}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => review.mutate({ providerId: provider.id, action: "approve" })}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectId(provider.id)}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminAsyncPanel>
  );
}
