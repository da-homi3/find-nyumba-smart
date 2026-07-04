import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AgencyShell } from "@/components/AgencyShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PortalCheckoutPage } from "@/components/dashboard/portal/PortalCheckoutPage";

const searchSchema = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  qty: z.coerce.number().optional(),
  reportType: z.string().optional(),
});

export const Route = createFileRoute("/agency/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Checkout — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <RouteErrorBoundary title="Checkout failed to load">
        <AgencyCheckout />
      </RouteErrorBoundary>
    </AgencyShell>
  ),
});

function AgencyCheckout() {
  const search = Route.useSearch();
  return <PortalCheckoutPage portal="agency" search={search} />;
}
