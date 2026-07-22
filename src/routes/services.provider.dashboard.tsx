import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PublicPageShell } from "@/components/SiteNav";
import { CustomerCareInfo } from "@/components/CustomerCareInfo";
import { getProviderAnalytics, getProviderDashboard } from "@/lib/api/service-provider.functions";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";
import {
  ProviderDashboardTabs,
  ProviderInquiriesPanel,
  ProviderOverviewPanel,
  ProviderPlanPanel,
  ProviderPricingPanel,
  ProviderProfilePanel,
  type ProviderDashboardTab,
} from "@/components/provider/ProviderDashboardSections";

const dashboardSearchSchema = z.object({
  tab: z.enum(["overview", "profile", "pricing", "inquiries", "plan"]).optional().catch("overview"),
});

export const Route = createFileRoute("/services/provider/dashboard")({
  validateSearch: dashboardSearchSchema,
  component: ProviderDashboardPage,
});

function ProviderDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { tab = "overview" } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["provider-dashboard", user?.id],
    enabled: !!user,
    queryFn: () => getProviderDashboard(),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["provider-analytics", user?.id],
    enabled: !!user && data?.provider?.status === "active",
    queryFn: () => getProviderAnalytics(),
  });

  function setTab(next: ProviderDashboardTab) {
    navigate({ search: { tab: next }, replace: true });
  }

  if (authLoading || isLoading) {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-3xl px-5 py-16 text-sm text-muted-foreground">Loading…</div>
      </PublicPageShell>
    );
  }

  if (!user) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <Link
            to="/auth"
            search={{ redirect: "/services/provider/dashboard" }}
            className="text-primary"
          >
            Sign in
          </Link>
        </main>
      </PublicPageShell>
    );
  }

  const provider = data?.provider;
  const subscription = data?.subscription;
  const inquiries = data?.inquiries ?? [];

  if (!provider) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <h1 className="font-display text-2xl font-semibold">No provider profile yet</h1>
          <Link to="/services/register" className="mt-4 inline-flex text-primary">
            Register your business →
          </Link>
        </main>
      </PublicPageShell>
    );
  }

  if (provider.status === "pending") {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Approval waitlist
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">
            {provider.business_name} is under review
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            NyumbaSearch operations reviews every service provider before they appear in the
            directory or unlock the provider dashboard. You&apos;ll get an email when you&apos;re
            approved.
          </p>
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-950 dark:text-amber-100">
            <p className="font-semibold">What happens next</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Our team checks your business details</li>
              <li>You stay on this waitlist until approved</li>
              <li>Once approved, tenants can find you and you can manage inquiries here</li>
            </ul>
          </div>
          <Link
            to="/services/register"
            className="mt-6 inline-flex rounded-xl border px-5 py-2.5 text-sm font-semibold"
          >
            Update application details
          </Link>
          <CustomerCareInfo className="mt-8 text-left" />
        </main>
      </PublicPageShell>
    );
  }

  if (provider.status === "rejected") {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <h1 className="font-display text-2xl font-semibold">Application not approved</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your service provider application for {provider.business_name} was not approved at this
            time. You can update your details and resubmit for review.
          </p>
          <Link
            to="/services/register"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Update &amp; resubmit
          </Link>
          <CustomerCareInfo className="mt-8 text-left" />
        </main>
      </PublicPageShell>
    );
  }

  if (provider.status !== "active") {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <h1 className="font-display text-2xl font-semibold">Dashboard unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your provider account status is {provider.status}. Contact customer care if you need
            help.
          </p>
          <CustomerCareInfo className="mt-6 text-left" />
        </main>
      </PublicPageShell>
    );
  }

  const defaultPhone =
    provider.phone ??
    (user.user_metadata?.phone as string | undefined) ??
    (user.phone as string | undefined) ??
    "";

  const activeTab = tab as ProviderDashboardTab;

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/services" className="text-sm text-primary">
            ← Services
          </Link>
          <DashboardSettingsLink variant="pill" />
        </div>

        <h1 className="mt-6 font-display text-2xl font-semibold">{provider.business_name}</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          {provider.tier} · {provider.status}
        </p>

        <div className="mt-6" data-tour="provider-dashboard-tabs">
          <ProviderDashboardTabs active={activeTab} onChange={setTab} />
        </div>

        <div className="mt-8">
          {activeTab === "overview" && (
            <section data-tour="provider-analytics">
              {analyticsLoading || !analytics ? (
                <p className="text-sm text-muted-foreground">Loading analytics…</p>
              ) : (
                <ProviderOverviewPanel
                  analytics={analytics}
                  provider={provider}
                  subscription={subscription ?? null}
                />
              )}
            </section>
          )}

          {activeTab === "profile" && (
            <section data-tour="provider-profile">
              <ProviderProfilePanel provider={provider} />
            </section>
          )}

          {activeTab === "pricing" && (
            <section data-tour="provider-pricing">
              <ProviderPricingPanel provider={provider} />
            </section>
          )}

          {activeTab === "inquiries" && (
            <section data-tour="provider-inquiries">
              <h2 className="mb-4 font-display text-lg font-semibold">
                Recent inquiries ({inquiries.length})
              </h2>
              <ProviderInquiriesPanel provider={provider} inquiries={inquiries} />
            </section>
          )}

          {activeTab === "plan" && (
            <section data-tour="provider-subscription">
              <ProviderPlanPanel
                provider={provider}
                subscription={subscription ?? null}
                defaultPhone={defaultPhone}
              />
            </section>
          )}
        </div>
      </main>
      <OnboardingTourHost tourId="provider-dashboard" />
    </PublicPageShell>
  );
}
