import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { ArrowLeft, Building2, ClipboardList, Users } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/manager/")({
  head: () => ({ meta: [{ title: "Property Manager Portal — NyumbaSearch" }] }),
  component: ManagerEntry,
});

function ManagerEntry() {
  const { user, isManager, loading, pendingApplications } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && isManager) {
      navigate({ to: "/manager/dashboard" });
      return;
    }
    if (user && hasPendingApplicationForRole(pendingApplications, "manager")) {
      navigate({ to: "/auth/pending" });
    }
  }, [user, isManager, loading, pendingApplications, navigate]);

  return (
    <div className="min-h-screen bg-foreground text-background">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-10 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col">
          <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-background/70">
            <ArrowLeft className="h-4 w-4" /> Back to tenants
          </Link>

          <div className="mt-6 w-fit rounded-xl bg-white px-4 py-2 shadow-sm">
            <BrandLogo logoClassName="h-8" />
          </div>

          <div className="mt-6 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-3 py-1 text-xs font-medium">
              <Building2 className="h-3 w-3 text-gold" /> Property Manager Portal
            </div>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Manage portfolios <span className="text-gold">at scale</span>.
            </h1>
            <p className="mt-5 max-w-md text-background/75">
              Onboard landlord clients, publish listings, and track leads from one dashboard. Sign
              up to start your 30-day free trial with full access — no payment required upfront.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: ClipboardList,
                  t: "Multi-landlord",
                  d: "Organize units across client portfolios.",
                },
                { icon: Users, t: "Lead routing", d: "Tenant inquiries tied to each listing." },
              ].map((f) => (
                <div
                  key={f.t}
                  className="rounded-2xl border border-background/15 bg-background/5 p-4"
                >
                  <f.icon className="h-5 w-5 text-gold" />
                  <h3 className="mt-3 font-display font-semibold">{f.t}</h3>
                  <p className="mt-1 text-xs text-background/65">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full rounded-3xl border border-background/15 bg-background p-8 text-foreground shadow-2xl">
            <h2 className="font-display text-2xl font-semibold">Apply as property manager</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account with your organization name. You&apos;ll get dashboard access after
              NyumbaSearch operations approves your application.
            </p>
            <Link
              to="/auth"
              search={{ signupFor: "manager", mode: "signup", redirect: "/manager/dashboard" }}
              className="mt-6 block w-full rounded-xl bg-foreground px-6 py-3 text-center text-sm font-semibold text-background"
            >
              Create manager account
            </Link>
            <Link
              to="/auth"
              search={{ signupFor: "manager", mode: "signin", redirect: "/manager/dashboard" }}
              className="mt-3 block text-center text-sm font-semibold text-primary"
            >
              Already approved? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
