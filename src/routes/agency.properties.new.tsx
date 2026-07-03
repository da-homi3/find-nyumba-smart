import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PropertyListingWizard } from "@/components/PropertyListingWizard";

export const Route = createFileRoute("/agency/properties/new")({
  component: () => (
    <AgencyShell>
      <PropertyListingWizard portalLabel="Real estate agency" />
    </AgencyShell>
  ),
});
