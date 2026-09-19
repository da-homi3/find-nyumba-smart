import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { OpenInviteInApp } from "@/components/OpenInviteInApp";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/invite/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `Pilot invitation — ${params.slug} — NyumbaSearch` }],
  }),
  component: VanityPilotInvitePage,
});

function inviteButtonLabel(isPending: boolean, signedIn: boolean): string {
  if (isPending) return "Opening dashboard…";
  if (signedIn) return "Accept & open dashboard";
  return "Sign in to continue";
}

function VanityPilotInvitePage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invitePath = `/invite/${slug}`;

  const accept = useMutation({
    mutationFn: async () => {
      const { acceptPilotInvitationBySlug } = await import("@/lib/api/pilot-partnership.functions");
      return acceptPilotInvitationBySlug({ data: { slug } });
    },
    onSuccess: () => {
      toast.success("You're in — opening your partner dashboard");
      void qc.invalidateQueries({ queryKey: ["my-pilots"] });
      navigate({ to: "/partner" });
    },
    onError: (e: Error) => {
      const msg = e.message ?? "";
      if (/Unauthorized|authorization|Bearer|not authenticated/i.test(msg)) {
        toast.message("Sign in to accept this invitation");
        navigate({
          to: "/auth",
          search: {
            mode: "signin",
            redirect: invitePath,
          },
        });
        return;
      }
      toast.error(msg || "Could not accept invitation");
    },
  });

  if (loading && user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <OpenInviteInApp path={invitePath} />
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Pilot Partnership
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold">Join your partner pilot</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Accept this invite to open your dashboard right away. No approval wait. You can add company
        details later in a couple of minutes.
      </p>

      {!user ? (
        <p className="mt-4 rounded-xl border bg-card px-3 py-2 text-sm">
          Sign in or create an account with the <strong>same email</strong> that received this
          invite.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={accept.isPending}
          onClick={() => {
            if (!user) {
              navigate({
                to: "/auth",
                search: {
                  mode: "signin",
                  redirect: invitePath,
                },
              });
              return;
            }
            accept.mutate();
          }}
          className="rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {inviteButtonLabel(accept.isPending, Boolean(user))}
        </button>
        {!user ? (
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/auth",
                search: {
                  mode: "signup",
                  redirect: invitePath,
                },
              })
            }
            className="rounded-xl border py-2.5 text-sm font-semibold"
          >
            Create account
          </button>
        ) : null}
        <Link to="/" className="text-center text-sm font-semibold text-muted-foreground underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
