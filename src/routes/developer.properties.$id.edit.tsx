import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PropertyEditForm } from "@/components/PropertyEditForm";

export const Route = createFileRoute("/developer/properties/$id/edit")({
  component: DeveloperEditPropertyPage,
});

function DeveloperEditPropertyPage() {
  const { id } = Route.useParams();
  return (
    <DeveloperShell>
      <PropertyEditForm
        propertyId={id}
        backTo="/developer/properties"
        invalidateQueryKey="developer-properties"
      />
    </DeveloperShell>
  );
}
