import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AgentShell } from "@/components/AgentShell";
import { PortalOverviewDashboard } from "@/components/dashboard/PortalOverviewDashboard";
import { listAgencyProperties, listLandlordLeads } from "@/lib/api/nyumba.functions";

export const Route = createFileRoute("/agent/dashboard/")({
  head: () => ({ meta: [{ title: "Agent dashboard — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <Dashboard />
    </AgentShell>
  ),
});

function Dashboard() {
  const { data: properties = [] } = useQuery({
    queryKey: ["agent-properties"],
    queryFn: () => listAgencyProperties(),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["agent-leads"],
    queryFn: () => listLandlordLeads(),
  });

  const newLeads = leads.filter((l) => l.status === "new").length;
  const totalViews = properties.reduce((sum, p) => sum + (p.views ?? 0), 0);

  return (
    <PortalOverviewDashboard
      portal="agent"
      welcomeName="agent"
      properties={properties}
      leadsCount={leads.length}
      newLeadsCount={newLeads}
      totalViews={totalViews}
      propertiesPath="/agent/properties"
      propertiesNewPath="/agent/properties/new"
      leadsPath="/agent/leads"
      teamPath="/agent/team"
    />
  );
}
