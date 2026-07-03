import { createFileRoute, Link } from "@tanstack/react-router";
import { PropertyEditForm } from "@/components/PropertyEditForm";
import { BrandLogoLink } from "@/components/BrandLogo";

export const Route = createFileRoute("/manager/properties/$id/edit")({
  head: () => ({ meta: [{ title: "Edit property — Property manager — NyumbaSearch" }] }),
  component: ManagerEditPropertyPage,
});

function ManagerEditPropertyPage() {
  const { id } = Route.useParams();
  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-foreground px-5 py-4 text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-xl bg-white px-3 py-2 shadow-sm">
              <BrandLogoLink to="/" logoClassName="h-7" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-background/60">
                Property manager
              </p>
              <h1 className="font-display text-lg font-semibold">Edit listing</h1>
            </div>
          </div>
          <Link to="/manager/properties" className="text-sm text-gold">
            ← Properties
          </Link>
        </div>
      </header>
      <PropertyEditForm
        propertyId={id}
        backTo="/manager/properties"
        invalidateQueryKey="manager-properties"
      />
    </div>
  );
}
