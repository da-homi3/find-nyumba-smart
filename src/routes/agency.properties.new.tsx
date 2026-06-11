import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PropertyListingWizard } from "./landlord.properties.new";

export const Route = createFileRoute("/agency/properties/new")({
  component: () => (
    <AgencyShell>
      <PropertyListingWizard />
    </AgencyShell>
  ),
});
