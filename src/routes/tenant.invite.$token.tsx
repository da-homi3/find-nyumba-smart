import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getPmTenantInvitePreview, respondPmTenantInvite } from "@/lib/api/pm.functions";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";

export const Route = createFileRoute("/tenant/invite/$token")({
  head: () => ({ meta: [{ title: "Tenancy invitation — NyumbaSearch" }] }),
  component: TenantInvitePage,
});

function TenantInvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const autoAcceptTried = useRef(false);

  const preview = useQuery({
    queryKey: ["pm-invite", token],
    queryFn: () => getPmTenantInvitePreview({ data: { token } }),
  });

  const respond = useMutation({
    mutationFn: (accept: boolean) => respondPmTenantInvite({ data: { token, accept } }),
    onSuccess: (res) => {
      if ("status" in res && res.status === "declined") {
        toast.success("Invitation declined");
        navigate({ to: "/tenant" });
        return;
      }
      toast.success("Invitation accepted — opening your rent portal");
      ensureTenantAccount().catch((err) => {
        console.warn("[invite] ensureTenantAccount:", err);
      });
      navigate({ to: "/tenant/rent" });
    },
    onError: (e: Error) => {
      const msg = e.message ?? "";
      if (/Unauthorized|authorization|Bearer/i.test(msg)) {
        toast.message("Sign in to accept this invitation");
        navigate({
          to: "/auth",
          search: {
            mode: "signin",
            redirect: `/tenant/invite/${token}`,
            signupFor: "tenant",
          },
        });
        return;
      }
      toast.error(msg || "Could not respond to invitation");
    },
  });

  // After signup/signin redirect back here, auto-accept once session is ready.
  useEffect(() => {
    if (loading || !user || !preview.data?.valid) return;
    if (autoAcceptTried.current || respond.isPending || respond.isSuccess) return;
    const params = new URLSearchParams(globalThis.location.search);
    const shouldAuto =
      params.get("auto") === "1" || sessionStorage.getItem(`pm-invite-auto:${token}`) === "1";
    if (!shouldAuto) return;
    autoAcceptTried.current = true;
    sessionStorage.removeItem(`pm-invite-auto:${token}`);
    respond.mutate(true);
  }, [loading, user, preview.data?.valid, respond, token]);

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
          This link is invalid or has expired. If you already accepted, open{" "}
          <Link to="/tenant/rent" className="font-semibold underline">
            Your rent
          </Link>
          .
        </p>
        <Link to="/tenant" className="mt-6 inline-block text-sm font-semibold underline">
          Back to home
        </Link>
      </div>
    );
  }

  const data = preview.data;

  function goAuth(mode: "signin" | "signup") {
    try {
      sessionStorage.setItem(`pm-invite-auto:${token}`, "1");
    } catch {
      // ignore
    }
    navigate({
      to: "/auth",
      search: {
        mode,
        redirect: `/tenant/invite/${token}`,
        signupFor: "tenant",
      },
    });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-semibold">Tenancy invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hi {data.tenantName} — you&apos;ve been invited to manage your tenancy at{" "}
        <strong className="text-foreground">{data.propertyName}</strong>
        {data.neighborhood ? ` (${data.neighborhood})` : ""} on NyumbaSearch.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        After you accept, your landlord still needs to attach a lease (unit + rent) before invoices
        appear. Complaints and maintenance work once that lease is active.
      </p>

      {!user ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
          {data.hasExistingAccount
            ? "Sign in with your existing account to accept."
            : "You’ll need a free NyumbaSearch account to accept."}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => {
            if (!user) {
              goAuth(data.hasExistingAccount ? "signin" : "signup");
              return;
            }
            respond.mutate(true);
          }}
          className="rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background"
        >
          {respond.isPending ? "Working…" : "Accept invitation"}
        </button>
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => {
            if (!user) {
              goAuth(data.hasExistingAccount ? "signin" : "signup");
              return;
            }
            respond.mutate(false);
          }}
          className="rounded-lg border border-border py-2.5 text-sm font-semibold"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
