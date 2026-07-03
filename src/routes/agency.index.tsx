import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { ArrowLeft, Building2, Globe, TrendingUp } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/agency/")({
  head: () => ({ meta: [{ title: "Real Estate Agency Portal — NyumbaSearch" }] }),
  component: AgencyEntry,
});

function AgencyEntry() {
  const { user, isAgency, loading, pendingApplications } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && isAgency) {
      navigate({ to: "/agency/dashboard" });
      return;
    }
    if (user && hasPendingApplicationForRole(pendingApplications, "agency")) {
      navigate({ to: "/auth/pending" });
    }
  }, [user, isAgency, loading, pendingApplications, navigate]);

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
              <Globe className="h-3 w-3 text-gold" /> Real Estate Agency Portal
            </div>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Run your agency on <span className="text-gold">NyumbaSearch</span>.
            </h1>
            <p className="mt-5 max-w-md text-background/75">
              Publish agency-wide listings, capture landlord leads, and grow your pipeline. New
              agency accounts are reviewed by operations before dashboard access.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Building2,
                  t: "Agency portfolio",
                  d: "List and manage properties under your brand.",
                },
                {
                  icon: TrendingUp,
                  t: "Lead pipeline",
                  d: "Track landlord and tenant opportunities.",
                },
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
            <h2 className="font-display text-2xl font-semibold">Apply as real estate agency</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign up with your agency name. After ops approval you&apos;ll land on the agency
              dashboard with full listing and lead tools.
            </p>
            <Link
              to="/auth"
              search={{ signupFor: "agency", mode: "signup", redirect: "/agency/dashboard" }}
              className="mt-6 block w-full rounded-xl bg-foreground px-6 py-3 text-center text-sm font-semibold text-background"
            >
              Create agency account
            </Link>
            <Link
              to="/auth"
              search={{ signupFor: "agency", mode: "signin", redirect: "/agency/dashboard" }}
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
