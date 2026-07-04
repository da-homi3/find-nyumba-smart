import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  approveOrgTeamMember,
  inviteOrgTeamMember,
  listOrgTeamMembers,
  revokeOrgTeamMember,
} from "@/lib/api/nyumba.functions";
import { errorMessage } from "@/lib/utils";
import { useOrgMembership } from "@/hooks/use-org-membership";

type Props = Readonly<{
  portalLabel: "Agency" | "Property manager";
}>;

export function OrgTeamPanel({ portalLabel }: Props) {
  const qc = useQueryClient();
  const { isOwner, loading: membershipLoading } = useOrgMembership();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["org-team"],
    queryFn: () => listOrgTeamMembers(),
  });

  const invite = useMutation({
    mutationFn: () =>
      inviteOrgTeamMember({ data: { email: email.trim(), fullName: fullName.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Invite email sent — approve them when ready to grant dashboard access");
      setEmail("");
      setFullName("");
      void qc.invalidateQueries({ queryKey: ["org-team"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const approve = useMutation({
    mutationFn: (memberUserId: string) => approveOrgTeamMember({ data: { memberUserId } }),
    onSuccess: () => {
      toast.success("Team member approved");
      void qc.invalidateQueries({ queryKey: ["org-team"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: (memberUserId: string) => revokeOrgTeamMember({ data: { memberUserId } }),
    onSuccess: () => {
      toast.success("Team member removed");
      void qc.invalidateQueries({ queryKey: ["org-team"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    invite.mutate();
  }

  if (membershipLoading || isLoading) {
    return <Loader2 className="mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  }

  if (!isOwner) {
    return (
      <div className="mt-8 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        Only the {portalLabel.toLowerCase()} owner can invite and approve team members.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <form onSubmit={onInvite} className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Invite team member</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter their email address — we&apos;ll send an invite with sign-in instructions. They stay
          pending until you approve them. Approved members can manage listings and leads, but cannot
          invite others or change owner settings.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name (optional)"
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={invite.isPending}
          className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {invite.isPending ? "Sending…" : "Send invite"}
        </button>
      </form>

      {members.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-6">
          <Users className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            No team members yet. Invite staff by email, then approve them to unlock limited
            dashboard access.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            >
              <div>
                <p className="text-sm font-semibold">
                  {m.profile?.full_name ?? m.email ?? "Team member"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.email ?? "—"}
                  {m.profile?.phone ? ` · ${m.profile.phone}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    m.role === "owner"
                      ? "bg-primary/15 text-primary"
                      : m.role === "pending"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m.role}
                </span>
                {m.role === "pending" && (
                  <button
                    type="button"
                    onClick={() => approve.mutate(m.user_id)}
                    disabled={approve.isPending}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Approve
                  </button>
                )}
                {m.role !== "owner" && (
                  <button
                    type="button"
                    onClick={() => revoke.mutate(m.user_id)}
                    disabled={revoke.isPending}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
