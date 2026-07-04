import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { OrgTeamPanel } from "@/components/dashboard/OrgTeamPanel";

export const Route = createFileRoute("/manager/team")({
  head: () => ({ meta: [{ title: "Team — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <div className="px-6 py-8 lg:px-10">
        <h1 className="font-display text-3xl font-semibold">Property manager team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only approved team members can access this dashboard. Members can manage portfolio
          listings and leads; owners control invites and approvals.
        </p>
        <OrgTeamPanel portalLabel="Property manager" />
      </div>
    </ManagerShell>
  ),
});
