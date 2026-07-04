import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PortalPlanPage } from "@/components/dashboard/portal/PortalPlanPage";

export const Route = createFileRoute("/landlord/dashboard/plan")({
  head: () => ({ meta: [{ title: "Plan — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PortalPlanPage portal="landlord" />
    </LandlordShell>
  ),
});
