import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PropertyListingWizard } from "@/components/PropertyListingWizard";

export const Route = createFileRoute("/landlord/properties/new")({
  component: () => (
    <LandlordShell>
      <PropertyListingWizard portalLabel="Landlord" />
    </LandlordShell>
  ),
});
