import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PropertyEditForm } from "@/components/PropertyEditForm";

export const Route = createFileRoute("/agent/properties/$id/edit")({
  component: AgentEditPropertyPage,
});

function AgentEditPropertyPage() {
  const { id } = Route.useParams();
  return (
    <AgentShell>
      <PropertyEditForm
        propertyId={id}
        backTo="/agent/properties"
        invalidateQueryKey="agent-properties"
      />
    </AgentShell>
  );
}
