import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PortalOverviewDashboard } from "@/components/dashboard/PortalOverviewDashboard";
import { listAgencyProperties, listLandlordLeads } from "@/lib/api/nyumba.functions";

export const Route = createFileRoute("/developer/dashboard/")({
  head: () => ({ meta: [{ title: "Developer dashboard — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <Dashboard />
    </DeveloperShell>
  ),
});

function Dashboard() {
  const { data: properties = [] } = useQuery({
    queryKey: ["developer-properties"],
    queryFn: () => listAgencyProperties(),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["developer-leads"],
    queryFn: () => listLandlordLeads(),
  });

  const newLeads = leads.filter((l) => l.status === "new").length;
  const totalViews = properties.reduce((sum, p) => sum + (p.views ?? 0), 0);

  return (
    <PortalOverviewDashboard
      portal="property_developer"
      welcomeName="developer"
      properties={properties}
      leadsCount={leads.length}
      newLeadsCount={newLeads}
      totalViews={totalViews}
      propertiesPath="/developer/properties"
      propertiesNewPath="/developer/properties/new"
      leadsPath="/developer/leads"
      teamPath="/developer/team"
    />
  );
}
