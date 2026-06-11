import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AgencyShell } from "@/components/AgencyShell";
import { listAgencyTeamMembers } from "@/lib/api/nyumba.functions";
import { Loader2, Users } from "lucide-react";

export const Route = createFileRoute("/agency/team")({
  head: () => ({ meta: [{ title: "Agency team — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <AgencyTeam />
    </AgencyShell>
  ),
});

function AgencyTeam() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["agency-team"],
    queryFn: () => listAgencyTeamMembers(),
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Agency team</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Members linked to your organization. Contact ops to invite additional agents.
      </p>

      {isLoading ? (
        <Loader2 className="mt-10 h-6 w-6 animate-spin text-muted-foreground" />
      ) : members.length === 0 ? (
        <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-card p-6">
          <Users className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            No team members yet. After your agency is approved, your owner account appears here
            automatically.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-2xl border bg-card">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-semibold text-sm">{m.profile?.full_name ?? "Team member"}</p>
                <p className="text-xs text-muted-foreground">{m.profile?.phone ?? "—"}</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
