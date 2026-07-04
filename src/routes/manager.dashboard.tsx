import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listManagerProperties, listLandlordLeads } from "@/lib/api/nyumba.functions";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalOverviewDashboard } from "@/components/dashboard/PortalOverviewDashboard";

export const Route = createFileRoute("/manager/dashboard")({
  head: () => ({ meta: [{ title: "Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <ManagerDashboard />
    </ManagerShell>
  ),
});

function ManagerDashboard() {
  const { data: properties = [] } = useQuery({
    queryKey: ["manager-properties"],
    queryFn: () => listManagerProperties(),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["manager-leads"],
    queryFn: () => listLandlordLeads(),
  });

  const newLeads = leads.filter((l) => l.status === "new").length;
  const totalViews = properties.reduce((sum, p) => sum + (p.views ?? 0), 0);

  return (
    <PortalOverviewDashboard
      portal="manager"
      welcomeName="manager"
      properties={properties}
      leadsCount={leads.length}
      newLeadsCount={newLeads}
      totalViews={totalViews}
      propertiesPath="/manager/properties"
      propertiesNewPath="/manager/properties/new"
      leadsPath="/manager/leads"
      teamPath="/manager/team"
    />
  );
}
