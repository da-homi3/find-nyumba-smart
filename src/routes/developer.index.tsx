import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { ArrowLeft, HardHat, Layers } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { buildPageHead } from "@/lib/seo/head";

export const Route = createFileRoute("/developer/")({
  head: () =>
    buildPageHead({
      title: "Property Developer Portal — NyumbaSearch",
      description:
        "Publish developer projects and units, capture tenant leads, and grow your pipeline on NyumbaSearch.",
      path: "/developer",
    }),
  component: DeveloperEntry,
});

function DeveloperEntry() {
  const { user, isPropertyDeveloper, loading, pendingApplications } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && isPropertyDeveloper) {
      navigate({ to: "/developer/dashboard" });
      return;
    }
    if (user && hasPendingApplicationForRole(pendingApplications, "property_developer")) {
      navigate({ to: "/auth/pending" });
    }
  }, [user, isPropertyDeveloper, loading, pendingApplications, navigate]);

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
              <HardHat className="h-3 w-3 text-gold" /> Property Developer Portal
            </div>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Launch projects on <span className="text-gold">NyumbaSearch</span>.
            </h1>
            <p className="mt-5 max-w-md text-background/75">
              List units under your developer brand, capture leads, and manage your portfolio after
              ops approval.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Layers,
                  t: "Project listings",
                  d: "Publish units and projects under your brand.",
                },
                {
                  icon: HardHat,
                  t: "Developer tools",
                  d: "Team seats, analytics, and lead capture.",
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
            <h2 className="font-display text-2xl font-semibold">Apply as property developer</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign up with your company name. After ops approval you&apos;ll land on the developer
              dashboard with listing and lead tools.
            </p>
            <Link
              to="/auth"
              search={{
                signupFor: "property_developer",
                mode: "signup",
                redirect: "/developer/dashboard",
              }}
              className="mt-6 block w-full rounded-xl bg-foreground px-6 py-3 text-center text-sm font-semibold text-background"
            >
              Create developer account
            </Link>
            <Link
              to="/auth"
              search={{
                signupFor: "property_developer",
                mode: "signin",
                redirect: "/developer/dashboard",
              }}
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
