import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PropertyListingWizard } from "@/components/PropertyListingWizard";

export const Route = createFileRoute("/developer/properties/new")({
  component: () => (
    <DeveloperShell>
      <PropertyListingWizard portalLabel="Developer" />
    </DeveloperShell>
  ),
});
