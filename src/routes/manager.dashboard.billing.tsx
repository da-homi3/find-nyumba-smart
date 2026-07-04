import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalBillingPage } from "@/components/dashboard/portal/PortalBillingPage";

export const Route = createFileRoute("/manager/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PortalBillingPage portal="manager" />
    </ManagerShell>
  ),
});
