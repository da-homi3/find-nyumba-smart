import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { PropertyEditForm } from "@/components/PropertyEditForm";
import { buildPageHead } from "@/lib/seo/head";

export const Route = createFileRoute("/admin/listings/$id/edit")({
  head: () =>
    buildPageHead({
      title: "Edit listing — Admin",
      description: "Edit an admin-owned property listing.",
      path: "/admin/listings/edit",
      noIndex: true,
    }),
  component: () => (
    <RouteErrorBoundary title="Admin edit listing page failed to load">
      <AdminEditListingPage />
    </RouteErrorBoundary>
  ),
});

function AdminEditListingPage() {
  const { id } = Route.useParams();

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
            <h1 className="truncate font-display text-lg font-bold sm:text-xl">Edit listing</h1>
          </div>
          <DashboardSettingsLink variant="pill" />
        </div>
      </header>

      <PropertyEditForm
        propertyId={id}
        backTo="/admin"
        backSearch={{ tab: "properties" }}
        invalidateQueryKey="admin-properties"
      />
    </div>
  );
}
