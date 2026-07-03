import { createFileRoute, Link } from "@tanstack/react-router";
import { PropertyEditForm } from "@/components/PropertyEditForm";
import { ManagerShell } from "@/components/ManagerShell";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";

export const Route = createFileRoute("/manager/properties/$id/edit")({
  head: () => ({ meta: [{ title: "Edit property — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <ManagerEditPropertyPage />
    </ManagerShell>
  ),
});

function ManagerEditPropertyPage() {
  const { id } = Route.useParams();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-4 lg:px-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Edit listing
          </p>
          <h1 className="font-display text-xl font-semibold">Property details</h1>
        </div>
        <div className="flex items-center gap-2">
          <DashboardSettingsLink variant="pill" />
          <Link to="/manager/properties" className="text-sm font-semibold text-primary">
            ← Properties
          </Link>
        </div>
      </div>
      <PropertyEditForm
        propertyId={id}
        backTo="/manager/properties"
        invalidateQueryKey="manager-properties"
      />
    </div>
  );
}
