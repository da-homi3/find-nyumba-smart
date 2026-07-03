import { createFileRoute, Link } from "@tanstack/react-router";
import { PropertyListingWizard } from "@/components/PropertyListingWizard";
import { ManagerShell } from "@/components/ManagerShell";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";

export const Route = createFileRoute("/manager/properties/new")({
  head: () => ({ meta: [{ title: "Add listing — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <ManagerNewPropertyPage />
    </ManagerShell>
  ),
});

function ManagerNewPropertyPage() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-4 lg:px-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            New listing
          </p>
          <h1 className="font-display text-xl font-semibold">Add property</h1>
        </div>
        <div className="flex items-center gap-2">
          <DashboardSettingsLink variant="pill" />
          <Link to="/manager/properties" className="text-sm font-semibold text-primary">
            ← Properties
          </Link>
        </div>
      </div>
      <PropertyListingWizard portalLabel="Property manager" />
    </div>
  );
}
