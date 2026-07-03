import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PropertyEditForm } from "@/components/PropertyEditForm";

export const Route = createFileRoute("/agency/properties/$id/edit")({
  component: AgencyEditPropertyPage,
});

function AgencyEditPropertyPage() {
  const { id } = Route.useParams();
  return (
    <AgencyShell>
      <PropertyEditForm
        propertyId={id}
        backTo="/agency/properties"
        invalidateQueryKey="agency-properties"
      />
    </AgencyShell>
  );
}
