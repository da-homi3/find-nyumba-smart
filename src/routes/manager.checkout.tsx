import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ManagerShell } from "@/components/ManagerShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PortalCheckoutPage } from "@/components/dashboard/portal/PortalCheckoutPage";

const searchSchema = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  qty: z.coerce.number().optional(),
  reportType: z.string().optional(),
});

export const Route = createFileRoute("/manager/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Checkout — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <RouteErrorBoundary title="Checkout failed to load">
        <ManagerCheckout />
      </RouteErrorBoundary>
    </ManagerShell>
  ),
});

function ManagerCheckout() {
  const search = Route.useSearch();
  return <PortalCheckoutPage portal="manager" search={search} />;
}
