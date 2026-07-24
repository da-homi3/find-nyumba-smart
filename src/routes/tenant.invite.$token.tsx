import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  getPmTenantInvitePreview,
  respondPmTenantInvite,
} from "@/lib/api/pm.functions";

export const Route = createFileRoute("/tenant/invite/$token")({
  head: () => ({ meta: [{ title: "Tenancy invitation — NyumbaSearch" }] }),
  component: TenantInvitePage,
});

function TenantInvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const preview = useQuery({
    queryKey: ["pm-invite", token],
    queryFn: () => getPmTenantInvitePreview({ data: { token } }),
  });

  const respond = useMutation({
    mutationFn: (accept: boolean) => respondPmTenantInvite({ data: { token, accept } }),
    onSuccess: (res) => {
      if ("requiresSignup" in res && res.requiresSignup) {
        toast.message("Create an account to accept this invitation");
        navigate({
          to: "/auth",
          search: {
            mode: "signup",
            redirect: `/tenant/invite/${token}`,
            signupFor: "tenant",
          },
        });
        return;
      }
      if ("status" in res && res.status === "declined") {
        toast.success("Invitation declined");
        navigate({ to: "/tenant" });
        return;
      }
      toast.success("Invitation accepted");
      navigate({ to: "/tenant" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (preview.isLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview.data?.valid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link is invalid or has expired.
        </p>
        <Link to="/tenant" className="mt-6 inline-block text-sm font-semibold underline">
          Back to home
        </Link>
      </div>
    );
  }

  const data = preview.data;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-semibold">Tenancy invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hi {data.tenantName} — you&apos;ve been invited to manage your tenancy at{" "}
        <strong className="text-foreground">{data.propertyName}</strong>
        {data.neighborhood ? ` (${data.neighborhood})` : ""} on NyumbaSearch.
      </p>

      {!user ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
          {data.hasExistingAccount
            ? "Sign in with your existing account to accept."
            : "You&apos;ll need a free NyumbaSearch account to accept."}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => {
            if (!user) {
              navigate({
                to: "/auth",
                search: data.hasExistingAccount
                  ? {
                      mode: "signin",
                      redirect: `/tenant/invite/${token}`,
                    }
                  : {
                      mode: "signup",
                      redirect: `/tenant/invite/${token}`,
                      signupFor: "tenant",
                    },
              });
              return;
            }
            respond.mutate(true);
          }}
          className="rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background"
        >
          Accept invitation
        </button>
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => respond.mutate(false)}
          className="rounded-lg border border-border py-2.5 text-sm font-semibold"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
