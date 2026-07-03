import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PropertyEditForm } from "@/components/PropertyEditForm";

export const Route = createFileRoute("/landlord/properties/$id/edit")({
  component: () => (
    <LandlordShell>
      <LandlordEditPropertyPage />
    </LandlordShell>
  ),
});

function LandlordEditPropertyPage() {
  const { id } = Route.useParams();
  return (
    <PropertyEditForm
      propertyId={id}
      backTo="/landlord/properties"
      invalidateQueryKey="my-properties-list"
    />
  );
}
