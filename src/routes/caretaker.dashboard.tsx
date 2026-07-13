import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCaretakerAssignedProperties,
  listCaretakerUpcomingViewings,
  updateCaretakerVacancy,
  validateCaretakerSession,
  type CaretakerViewing,
} from "@/lib/api/caretaker.functions";
import { getCaretakerToken, clearCaretakerToken } from "@/lib/caretaker-session";
import { Building2, Calendar, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import type { Property } from "@/lib/properties";
import { BrandLogoLink } from "@/components/BrandLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";

export const Route = createFileRoute("/caretaker/dashboard")({
  head: () => ({ meta: [{ title: "Caretaker dashboard — NyumbaSearch" }] }),
  component: () => (
    <RouteErrorBoundary title="Caretaker dashboard failed to load">
      <CaretakerDashboard />
    </RouteErrorBoundary>
  ),
});

function formatViewingWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function propertyIsVacant(p: Property): boolean {
  return p.is_vacant !== false;
}

function vacancyBadgeClass(isVacant: boolean): string {
  return isVacant ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700";
}

function CaretakerViewingsPanel({
  loading,
  viewings,
}: Readonly<{ loading: boolean; viewings: CaretakerViewing[] }>) {
  if (loading) {
    return <div className="mt-3 h-16 animate-pulse rounded-xl bg-muted" />;
  }
  if (viewings.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        No scheduled viewings for your assigned properties yet.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-3">
      {viewings.map((v) => (
        <li key={v.id} className="rounded-xl border bg-secondary/40 px-3 py-2.5 text-sm">
          <p className="font-medium">{v.propertyTitle}</p>
          <p className="text-xs text-muted-foreground">
            {v.propertyNeighborhood}
            {v.tenantName ? ` · ${v.tenantName}` : ""}
          </p>
          <p className="mt-1 text-xs font-semibold text-primary">
            {formatViewingWhen(v.scheduledAt)} · {v.status}
          </p>
          {v.notes ? <p className="mt-1 text-xs text-muted-foreground">{v.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function CaretakerPropertyCard({
  property,
  onToggleVacancy,
}: Readonly<{
  property: Property;
  onToggleVacancy: (propertyId: string, isVacant: boolean) => void;
}>) {
  const isVacant = propertyIsVacant(property);
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        {property.images[0] ? (
          <img src={property.images[0]} alt="" className="h-16 w-20 rounded-lg object-cover" />
        ) : (
          <div className="grid h-16 w-20 place-items-center rounded-lg bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <p className="font-semibold">{property.title}</p>
          <p className="text-xs text-muted-foreground">{property.neighborhood}</p>
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${vacancyBadgeClass(isVacant)}`}
          >
            {isVacant ? "Vacant" : "Occupied"}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Mark as ${isVacant ? "occupied" : "vacant"}?`)) {
            onToggleVacancy(property.id, !isVacant);
          }
        }}
        className="mt-3 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
      >
        <ToggleLeft className="h-3.5 w-3.5" /> Toggle vacancy
      </button>
    </div>
  );
}

function CaretakerPropertiesPanel({
  loading,
  properties,
  onToggleVacancy,
}: Readonly<{
  loading: boolean;
  properties: Property[];
  onToggleVacancy: (propertyId: string, isVacant: boolean) => void;
}>) {
  if (loading) {
    return <div className="mt-3 h-24 animate-pulse rounded-2xl bg-muted" />;
  }
  if (properties.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">No properties assigned yet.</p>;
  }
  return (
    <div className="mt-3 space-y-4">
      {properties.map((p) => (
        <CaretakerPropertyCard key={p.id} property={p} onToggleVacancy={onToggleVacancy} />
      ))}
    </div>
  );
}

function CaretakerDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = getCaretakerToken();

  const { data: session } = useQuery({
    queryKey: ["caretaker-session", token],
    enabled: Boolean(token),
    queryFn: () => validateCaretakerSession({ data: { token: token! } }),
    retry: false,
  });

  useEffect(() => {
    if (!token) {
      navigate({ to: "/caretaker", replace: true });
    }
  }, [navigate, token]);

  useEffect(() => {
    if (session === undefined) return;
    if (!session?.valid) {
      clearCaretakerToken();
      navigate({ to: "/caretaker", replace: true });
    }
  }, [session, navigate]);

  const sessionReady = Boolean(token && session?.valid);

  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["caretaker-properties", token],
    enabled: sessionReady,
    queryFn: () => listCaretakerAssignedProperties({ data: { token: token! } }),
  });

  const { data: viewings = [], isLoading: viewingsLoading } = useQuery({
    queryKey: ["caretaker-viewings", token],
    enabled: sessionReady,
    queryFn: () => listCaretakerUpcomingViewings({ data: { token: token! } }),
  });

  const toggleVacancy = useMutation({
    mutationFn: ({ propertyId, isVacant }: { propertyId: string; isVacant: boolean }) =>
      updateCaretakerVacancy({ data: { token: token!, propertyId, isVacant } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker-properties"] });
      toast.success("Vacancy updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!token) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-background px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogoLink to="/tenant" compact />
            <div>
              <h1 className="font-display text-lg font-semibold">Caretaker dashboard</h1>
              {session?.name ? (
                <p className="text-xs text-muted-foreground">Signed in as {session.name}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DashboardSettingsLink variant="header" />
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <button
              type="button"
              onClick={() => {
                clearCaretakerToken();
                navigate({ to: "/caretaker" });
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-5 py-6">
        <p className="text-sm text-muted-foreground">
          Assigned properties only — you cannot change pricing or view analytics.
        </p>

        <section className="rounded-2xl border bg-card p-4" data-tour="caretaker-viewings">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming viewings
          </h2>
          <CaretakerViewingsPanel loading={viewingsLoading} viewings={viewings} />
        </section>

        <section className="rounded-2xl border bg-card p-4" data-tour="caretaker-quick-replies">
          <h2 className="font-display text-sm font-semibold">Quick replies</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap to copy a reply for tenant inquiries.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Still available — please book a viewing.",
              "Please book a viewing on NyumbaSearch.",
              "Contact the landlord directly for urgent matters.",
            ].map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(text);
                  toast.success("Reply copied");
                }}
                className="rounded-full border px-3 py-2 text-xs font-medium hover:bg-secondary"
              >
                {text}
              </button>
            ))}
          </div>
        </section>

        <section data-tour="caretaker-properties">
          <h2 className="font-display text-sm font-semibold">Your properties</h2>
          <CaretakerPropertiesPanel
            loading={propertiesLoading}
            properties={properties}
            onToggleVacancy={(propertyId, isVacant) =>
              toggleVacancy.mutate({ propertyId, isVacant })
            }
          />
        </section>
      </main>
      <OnboardingTourHost tourId="caretaker-dashboard" />
    </div>
  );
}
