import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { AdminListingAccountPicker } from "@/components/admin/AdminListingAccountPicker";
import {
  PropertyListingWizard,
  type ListingOnBehalfTarget,
} from "@/components/PropertyListingWizard";
import { portalLabelForRole } from "@/lib/portal-labels";
import { buildPageHead } from "@/lib/seo/head";
import { cn } from "@/lib/utils";
import { isListingUploadBusy } from "@/lib/media/listing-upload-session";
import { toast } from "sonner";

function parseListingMode(value: unknown): "self" | "behalf" | undefined {
  if (value === "behalf") return "behalf";
  if (value === "self") return "self";
  return undefined;
}

export const Route = createFileRoute("/admin/listings/new")({
  head: () =>
    buildPageHead({
      title: "Upload listing — Admin",
      description: "Create a property listing as admin or on behalf of a landlord, agency, or manager.",
      path: "/admin/listings/new",
      noIndex: true,
    }),
  validateSearch: (search: Record<string, unknown>): { mode?: "self" | "behalf" } => ({
    mode: parseListingMode(search.mode),
  }),
  component: () => (
    <RouteErrorBoundary title="Admin listing page failed to load">
      <AdminCreateListingPage />
    </RouteErrorBoundary>
  ),
});

function AdminCreateListingPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"self" | "behalf">(search.mode === "behalf" ? "behalf" : "self");
  const [selected, setSelected] = useState<ListingOnBehalfTarget | null>(null);

  function switchMode(next: "self" | "behalf") {
    if (next === mode) return;
    if (isListingUploadBusy()) {
      toast.error("Wait for the current upload to finish before switching mode.");
      return;
    }
    setMode(next);
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              to="/admin"
              search={{ tab: "properties" }}
              aria-label="Back to admin"
              className="shrink-0 rounded-full p-1.5 hover:bg-secondary"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div className="shrink-0 rounded-lg bg-white px-2 py-1 shadow-sm">
              <BrandLogo logoClassName="h-6" />
            </div>
            <h1 className="truncate font-display text-lg font-bold sm:text-xl">
              {mode === "self" ? "Upload listing" : "List on behalf"}
            </h1>
          </div>
          <DashboardSettingsLink variant="pill" />
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-3xl space-y-6 px-4 sm:px-6">
        <div className="flex gap-2 rounded-xl border bg-card p-1">
          <button
            type="button"
            onClick={() => switchMode("self")}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
              mode === "self" ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
            )}
          >
            Upload independently
          </button>
          <button
            type="button"
            onClick={() => switchMode("behalf")}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
              mode === "behalf" ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
            )}
          >
            On behalf of account
          </button>
        </div>

        {mode === "self" ? (
          <PropertyListingWizard
            portalLabel="Admin"
            adminOwned
            redirectTo="/admin"
            redirectSearch={{ tab: "properties" }}
          />
        ) : (
          <>
            <AdminListingAccountPicker selected={selected} onSelect={setSelected} />

            {selected ? (
              <PropertyListingWizard
                portalLabel={portalLabelForRole(selected.portalRole)}
                onBehalfOf={selected}
                redirectTo="/admin"
                redirectSearch={{ tab: "properties" }}
              />
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Select an account above to open the listing wizard.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
