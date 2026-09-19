import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AgentShell } from "@/components/AgentShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PortalCheckoutPage } from "@/components/dashboard/portal/PortalCheckoutPage";

const searchSchema = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  qty: z.coerce.number().optional(),
  reportType: z.string().optional(),
});

export const Route = createFileRoute("/agent/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Checkout — Agent — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <RouteErrorBoundary title="Checkout failed to load">
        <Checkout />
      </RouteErrorBoundary>
    </AgentShell>
  ),
});

function Checkout() {
  const search = Route.useSearch();
  return <PortalCheckoutPage portal="agent" search={search} />;
}
