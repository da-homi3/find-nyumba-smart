import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalOverviewDashboard } from "@/components/dashboard/PortalOverviewDashboard";
import { listAgencyProperties, listLandlordLeads } from "@/lib/api/nyumba.functions";

export const Route = createFileRoute("/agency/dashboard")({
  head: () => ({ meta: [{ title: "Agency dashboard — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <AgencyDashboard />
    </AgencyShell>
  ),
});

function AgencyDashboard() {
  const { data: properties = [] } = useQuery({
    queryKey: ["agency-properties"],
    queryFn: () => listAgencyProperties(),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["agency-leads"],
    queryFn: () => listLandlordLeads(),
  });

  const newLeads = leads.filter((l) => l.status === "new").length;
  const totalViews = properties.reduce((sum, p) => sum + (p.views ?? 0), 0);

  return (
    <PortalOverviewDashboard
      portal="agency"
      welcomeName="agency"
      properties={properties}
      leadsCount={leads.length}
      newLeadsCount={newLeads}
      totalViews={totalViews}
      propertiesPath="/agency/properties"
      propertiesNewPath="/agency/properties/new"
      leadsPath="/agency/leads"
      teamPath="/agency/team"
    />
  );
}
