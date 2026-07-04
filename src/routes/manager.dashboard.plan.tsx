import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalPlanPage } from "@/components/dashboard/portal/PortalPlanPage";

export const Route = createFileRoute("/manager/dashboard/plan")({
  head: () => ({ meta: [{ title: "Plan — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PortalPlanPage portal="manager" />
    </ManagerShell>
  ),
});
