import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalBillingPage } from "@/components/dashboard/portal/PortalBillingPage";

export const Route = createFileRoute("/agency/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PortalBillingPage portal="agency" />
    </AgencyShell>
  ),
});
