import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { OrgTeamPanel } from "@/components/dashboard/OrgTeamPanel";

export const Route = createFileRoute("/agent/team")({
  head: () => ({ meta: [{ title: "Agent team — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <div className="px-6 py-8 lg:px-10">
        <h1 className="font-display text-3xl font-semibold">Agent team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only approved team members can access this dashboard. Members can manage listings and
          leads; owners control invites and approvals.
        </p>
        <OrgTeamPanel portalLabel="Agent" />
      </div>
    </AgentShell>
  ),
});
