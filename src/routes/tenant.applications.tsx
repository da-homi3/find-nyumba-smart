import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/hooks/use-auth";
import { buildPageHead } from "@/lib/seo/head";
import { formatKes } from "@/lib/properties";
import {
  listMyPropertyApplications,
  withdrawPropertyApplication,
} from "@/lib/api/rental-application.functions";
import { errorMessage } from "@/lib/utils";
import {
  canWithdrawRentalApplication,
  formatRentalApplicationStatus,
} from "@/lib/rental-applications/status";

export const Route = createFileRoute("/tenant/applications")({
  head: () =>
    buildPageHead({
      title: "My applications — NyumbaSearch",
      description: "Track rental applications you have submitted on NyumbaSearch.",
      path: "/tenant/applications",
      noIndex: true,
    }),
  component: TenantApplicationsPage,
});

function TenantApplicationsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["tenant-applications", user?.id],
    enabled: !!user,
    queryFn: () => listMyPropertyApplications(),
  });

  const withdraw = useMutation({
    mutationFn: (applicationId: string) => withdrawPropertyApplication({ data: { applicationId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-applications"] });
      toast.success("Application withdrawn");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">My applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rental applications you have submitted to landlords.
        </p>

        {loading || isLoading ? (
          <div className="mt-8 space-y-4">
            {["app-sk-1", "app-sk-2"].map((id) => (
              <div key={id} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : !user ? (
          <p className="mt-8 text-sm text-muted-foreground">
            <Link
              to="/auth"
              search={{ mode: "signin", redirect: "/tenant/applications" }}
              className="font-semibold text-primary underline"
            >
              Sign in
            </Link>{" "}
            to view your applications.
          </p>
        ) : applications.length === 0 ? (
          <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No applications yet. Tap Apply on a listing to send your tenant profile to a landlord.
            </p>
            <Link
              to="/tenant"
              className="mt-4 inline-block rounded-xl bg-gradient-emerald px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Browse homes
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {applications.map((app) => {
              const property = app.property as {
                id?: string;
                title?: string;
                neighborhood?: string;
                rent_kes?: number;
              } | null;
              return (
                <article key={app.id} className="rounded-2xl border bg-card p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-lg font-semibold">
                          {property?.title ?? "Listing"}
                        </h2>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize">
                          {formatRentalApplicationStatus(app.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {property?.neighborhood ?? "Kenya"}
                        {property?.rent_kes ? ` · ${formatKes(property.rent_kes)}` : ""}
                      </p>
                      {app.tenant_score_percent != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Profile score at submission: {app.tenant_score_percent}%
                        </p>
                      )}
                    </div>
                    {property?.id && (
                      <Link
                        to="/tenant/property/$id"
                        params={{ id: property.id }}
                        className="rounded-xl border px-3 py-2 text-sm font-semibold"
                      >
                        View listing
                      </Link>
                    )}
                  </div>
                  {app.message && (
                    <p className="mt-3 rounded-xl bg-secondary p-3 text-sm">{app.message}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border px-3 py-1.5">
                      Submitted {new Date(app.created_at).toLocaleDateString()}
                    </span>
                    {app.move_in_date && (
                      <span className="rounded-full border px-3 py-1.5">
                        Move-in {app.move_in_date}
                      </span>
                    )}
                    {canWithdrawRentalApplication(app.status) && (
                      <button
                        type="button"
                        disabled={withdraw.isPending}
                        onClick={() => withdraw.mutate(app.id)}
                        className="rounded-full border px-3 py-1.5 font-semibold text-foreground"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                  <ol className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide">
                    {(["submitted", "under_review", "accepted", "rejected"] as const).map(
                      (step, i) => {
                        const status = String(app.status);
                        const active =
                          status === step ||
                          (step === "submitted" && status === "pending") ||
                          (step === "under_review" &&
                            ["reviewing", "under_review", "in_review"].includes(status));
                        const done =
                          (step === "submitted" && status !== "draft") ||
                          (step === "under_review" &&
                            ["accepted", "approved", "rejected", "declined"].includes(status)) ||
                          (step === "accepted" && ["accepted", "approved"].includes(status)) ||
                          (step === "rejected" && ["rejected", "declined", "withdrawn"].includes(status));
                        return (
                          <li
                            key={step}
                            className={`rounded-full px-2.5 py-1 ${
                              active || done
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {i + 1}. {step.replaceAll("_", " ")}
                          </li>
                        );
                      },
                    )}
                  </ol>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
