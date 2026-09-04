import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Phone } from "lucide-react";
import { toast } from "sonner";
import { LandlordShell } from "@/components/LandlordShell";
import { useAuth } from "@/hooks/use-auth";
import { formatKes } from "@/lib/properties";
import {
  listLandlordPropertyApplications,
  reviewPropertyApplication,
} from "@/lib/api/rental-application.functions";
import { errorMessage } from "@/lib/utils";
import { formatRentalApplicationStatus } from "@/lib/rental-applications/status";

type ReviewStatus = "under_review" | "approved" | "rejected";

export const Route = createFileRoute("/landlord/applications")({
  component: () => (
    <LandlordShell>
      <LandlordApplicationsPage />
    </LandlordShell>
  ),
});

function LandlordApplicationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["landlord-applications", user?.id],
    enabled: !!user,
    queryFn: () => listLandlordPropertyApplications(),
  });

  const review = useMutation({
    mutationFn: (payload: {
      applicationId: string;
      status: ReviewStatus;
      landlordNotes?: string;
    }) => reviewPropertyApplication({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlord-applications"] });
      toast.success("Application updated");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenants who applied to rent your listings with profile scores attached.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {applications.length} total
        </span>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4">
          {["land-app-1", "land-app-2"].map((id) => (
            <div key={id} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No rental applications yet. They appear here when tenants tap Apply on your listings.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {applications.map((app) => {
            const property = app.property as {
              id?: string;
              title?: string;
              neighborhood?: string;
              rent_kes?: number;
            } | null;
            const tenant = app.tenant_profile as {
              full_name?: string;
              phone?: string;
            } | null;
            return (
              <article key={app.id} className="rounded-2xl border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">
                        {tenant?.full_name ?? "Tenant applicant"}
                      </h2>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize">
                        {formatRentalApplicationStatus(app.status)}
                      </span>
                      {app.tenant_score_percent != null && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {app.tenant_score_percent}% profile
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {property?.title ?? "Listing"}
                      {property?.rent_kes ? ` · ${formatKes(property.rent_kes)}` : ""}
                    </p>
                  </div>
                  <select
                    value={app.status === "submitted" ? "under_review" : app.status}
                    disabled={app.status === "withdrawn"}
                    onChange={(event) =>
                      review.mutate({
                        applicationId: app.id,
                        status: event.target.value as ReviewStatus,
                      })
                    }
                    className="rounded-xl border bg-background px-3 py-2 text-sm outline-none disabled:opacity-50"
                  >
                    <option value="under_review">Under review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {app.message && (
                  <p className="mt-4 rounded-xl bg-secondary p-3 text-sm">{app.message}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {tenant?.phone && (
                    <a
                      href={`tel:${tenant.phone}`}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-medium text-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" /> {tenant.phone}
                    </a>
                  )}
                  {property?.id && (
                    <Link
                      to="/tenant/property/$id"
                      params={{ id: property.id }}
                      className="rounded-full border px-3 py-1.5 font-medium text-foreground"
                    >
                      View listing
                    </Link>
                  )}
                  <span className="rounded-full border px-3 py-1.5">
                    {new Date(app.created_at).toLocaleDateString()}
                  </span>
                  {app.move_in_date && (
                    <span className="rounded-full border px-3 py-1.5">
                      Move-in {app.move_in_date}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
