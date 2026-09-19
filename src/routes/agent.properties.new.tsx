import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PropertyListingWizard } from "@/components/PropertyListingWizard";

export const Route = createFileRoute("/agent/properties/new")({
  component: () => (
    <AgentShell>
      <PropertyListingWizard portalLabel="Agent" />
    </AgentShell>
  ),
});
