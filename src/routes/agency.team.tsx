import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { Users } from "lucide-react";

export const Route = createFileRoute("/agency/team")({
  component: () => (
    <AgencyShell>
      <div className="px-6 py-8 lg:px-10">
        <h1 className="font-display text-3xl font-semibold">Agency team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite agents to your organization — contact ops to add team members after approval.
        </p>
        <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-card p-6">
          <Users className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            Team management expands in a future release. Your agency owner account can list
            unlimited properties today.
          </p>
        </div>
      </div>
    </AgencyShell>
  ),
});
