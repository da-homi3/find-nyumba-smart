import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { OrgTeamPanel } from "@/components/dashboard/OrgTeamPanel";

export const Route = createFileRoute("/developer/team")({
  head: () => ({ meta: [{ title: "Developer team — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <div className="px-6 py-8 lg:px-10">
        <h1 className="font-display text-3xl font-semibold">Developer team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only approved team members can access this dashboard. Members can manage listings and
          leads; owners control invites and approvals.
        </p>
        <OrgTeamPanel portalLabel="Developer" />
      </div>
    </DeveloperShell>
  ),
});
