import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DeveloperShell } from "@/components/DeveloperShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PortalCheckoutPage } from "@/components/dashboard/portal/PortalCheckoutPage";

const searchSchema = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  qty: z.coerce.number().optional(),
  reportType: z.string().optional(),
});

export const Route = createFileRoute("/developer/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Checkout — Developer — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <RouteErrorBoundary title="Checkout failed to load">
        <Checkout />
      </RouteErrorBoundary>
    </DeveloperShell>
  ),
});

function Checkout() {
  const search = Route.useSearch();
  return <PortalCheckoutPage portal="property_developer" search={search} />;
}
