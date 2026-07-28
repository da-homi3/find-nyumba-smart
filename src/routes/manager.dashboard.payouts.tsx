import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalPayoutSettingsPage } from "@/components/dashboard/portal/PortalPayoutSettingsPage";

export const Route = createFileRoute("/manager/dashboard/payouts")({
  head: () => ({ meta: [{ title: "Rent payouts — Manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PortalPayoutSettingsPage />
    </ManagerShell>
  ),
});
