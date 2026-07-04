import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { OrgTeamPanel } from "@/components/dashboard/OrgTeamPanel";

export const Route = createFileRoute("/agency/team")({
  head: () => ({ meta: [{ title: "Agency team — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <div className="px-6 py-8 lg:px-10">
        <h1 className="font-display text-3xl font-semibold">Agency team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only approved team members can access the agency dashboard. Members can manage listings
          and leads; owners control invites and approvals.
        </p>
        <OrgTeamPanel portalLabel="Agency" />
      </div>
    </AgencyShell>
  ),
});
