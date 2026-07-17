import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { Building2, BarChart3, Users, Sparkles, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LANDLORD_PLANS } from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";
import { buildPageHead } from "@/lib/seo/head";

export const Route = createFileRoute("/landlord/")({
  head: () =>
    buildPageHead({
      title: "Landlord Portal — NyumbaSearch",
      description:
        "List properties, reach verified tenants directly, and manage leads from one dashboard. Verified property owners, no hidden fees.",
      path: "/landlord",
    }),
  component: LandlordEntry,
});

function LandlordEntry() {
  const { user, isLandlord, loading, pendingApplications } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && isLandlord) {
      navigate({ to: "/landlord/dashboard" });
      return;
    }
    if (user && hasPendingApplicationForRole(pendingApplications, "landlord")) {
      navigate({ to: "/auth/pending" });
    }
  }, [user, isLandlord, loading, pendingApplications, navigate]);

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
              <Building2 className="h-3 w-3 text-gold" /> Landlord Portal
            </div>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Reach verified tenants <span className="text-gold">directly</span>.
            </h1>
            <p className="mt-5 max-w-md text-background/75">
              List, track, and rent your properties from one premium dashboard. Sign up to start
              your 30-day free trial with full access — no payment required upfront.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: BarChart3,
                  t: "Live analytics",
                  d: "Views, saves, lead conversion per unit.",
                },
                { icon: Users, t: "Direct leads", d: "Verified tenant inquiries in real time." },
                {
                  icon: Sparkles,
                  t: "AI optimization",
                  d: "Pricing & listing quality suggestions.",
                },
                { icon: Building2, t: "Multi-property", d: "Manage one building or twenty." },
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

            <div className="mt-10 rounded-2xl border border-background/15 bg-background/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold">Plans</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {LANDLORD_PLANS.map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-background/10 p-3 text-sm">
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-gold">
                      {plan.priceKes === 0 ? "Free" : formatKes(plan.priceKes)}
                      {plan.period}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                to="/pricing"
                className="mt-4 inline-block text-xs font-semibold text-gold hover:underline"
              >
                Compare plans & boosts →
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full rounded-3xl border border-background/15 bg-background p-8 text-foreground shadow-2xl">
            <h2 className="font-display text-2xl font-semibold">Apply as landlord</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account with your portfolio or business name and a verified M-Pesa phone
              number. NyumbaSearch operations will review your application before you can list
              properties.
            </p>
            <Link
              to="/auth"
              search={{ signupFor: "landlord", mode: "signup", redirect: "/landlord/dashboard" }}
              className="mt-6 block w-full rounded-xl bg-foreground px-6 py-3 text-center text-sm font-semibold text-background"
            >
              Create landlord account
            </Link>
            <Link
              to="/auth"
              search={{ signupFor: "landlord", mode: "signin", redirect: "/landlord/dashboard" }}
              className="mt-3 block text-center text-sm font-semibold text-primary"
            >
              Already approved? Sign in
            </Link>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Property manager?{" "}
              <Link
                to="/auth"
                search={{ redirect: "/manager/dashboard", signupFor: "manager", mode: "signup" }}
                className="font-semibold text-primary"
              >
                Apply as manager
              </Link>
              {" · "}
              <Link
                to="/auth"
                search={{ redirect: "/agency/dashboard", signupFor: "agency", mode: "signup" }}
                className="font-semibold text-primary"
              >
                Real estate agency
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
