import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PortalPlanPage } from "@/components/dashboard/portal/PortalPlanPage";

export const Route = createFileRoute("/developer/dashboard/plan")({
  head: () => ({ meta: [{ title: "Plan — Developer — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <PortalPlanPage portal="property_developer" />
    </DeveloperShell>
  ),
});
