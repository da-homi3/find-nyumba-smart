import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PortalBillingPage } from "@/components/dashboard/portal/PortalBillingPage";

export const Route = createFileRoute("/developer/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing — Developer — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <PortalBillingPage portal="property_developer" />
    </DeveloperShell>
  ),
});
