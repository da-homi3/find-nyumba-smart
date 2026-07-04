import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PortalBillingPage } from "@/components/dashboard/portal/PortalBillingPage";

export const Route = createFileRoute("/landlord/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PortalBillingPage portal="landlord" />
    </LandlordShell>
  ),
});
