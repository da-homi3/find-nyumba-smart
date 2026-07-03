import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock, LogOut } from "lucide-react";
import { BrandLogoLink } from "@/components/BrandLogo";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth/pending")({
  component: PendingApproval,
});

function PendingApproval() {
  const { user, pendingApplications, signOut } = useAuth();
  const navigate = useNavigate();
  const pending = pendingApplications.filter((a) => a.status === "pending");

  useEffect(() => {
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: "/auth/pending", mode: "signin" },
        replace: true,
      });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex justify-center px-6 pt-10">
        <BrandLogoLink to="/tenant" />
      </div>
      <div className="mx-auto max-w-md px-6 pt-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold">Application under review</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {user?.email
            ? `We received your application for ${pending.map((p) => p.requested_role).join(", ") || "a privileged account"}. Our team at NyumbaSearch operations will email you once approved.`
            : "Sign in to check your application status."}
        </p>
        {pending.length > 0 && (
          <ul className="mt-6 space-y-2 text-left text-sm">
            {pending.map((app) => (
              <li key={app.id} className="rounded-xl border bg-card px-4 py-3">
                <span className="font-semibold capitalize">{app.requested_role}</span>
                {app.organization_name && (
                  <span className="text-muted-foreground"> · {app.organization_name}</span>
                )}
                <span className="mt-1 block text-xs text-amber-600">Pending ops approval</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          You can still browse listings as a tenant while you wait.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/tenant"
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Browse homes
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
