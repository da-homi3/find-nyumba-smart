import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicPageShell } from "@/components/SiteNav";
import { getProviderDashboard } from "@/lib/api/service-provider.functions";
import { providerTierPrice } from "@/lib/revenue/plans";
import { useAuth } from "@/hooks/use-auth";
import { formatKes } from "@/lib/properties";
import { whatsAppUrl } from "@/lib/phone";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";

export const Route = createFileRoute("/services/provider/dashboard")({
  component: ProviderDashboardPage,
});

function ProviderDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["provider-dashboard", user?.id],
    enabled: !!user,
    queryFn: () => getProviderDashboard(),
  });

  if (authLoading || isLoading) {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-2xl px-5 py-16 text-sm text-muted-foreground">Loading…</div>
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

  const trialDaysLeft =
    subscription?.status === "trialing" && subscription.trial_end
      ? Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / 86400000)
      : null;

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-2xl px-5 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/services" className="text-sm text-primary">
            ← Services
          </Link>
          <DashboardSettingsLink variant="pill" />
        </div>

        {trialDaysLeft !== null && trialDaysLeft > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left, then{" "}
            {formatKes(providerTierPrice(subscription?.plan ?? provider.tier))}/mo
          </div>
        )}

        <h1 className="mt-6 font-display text-2xl font-semibold">{provider.business_name}</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          {provider.tier} · {provider.status}
        </p>

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Subscription plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {subscription?.status === "active"
              ? `Active — ${provider.tier} tier`
              : "Upgrade for higher placement in tenant search"}
          </p>
          <Link
            to="/services/register"
            className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {subscription?.status === "active" ? "Change plan" : "Choose a plan & pay"}
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">
            Recent inquiries ({inquiries.length})
          </h2>
          {inquiries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No inquiries yet — your listing appears once your plan is active.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {inquiries.map((inq) => {
                const profile = inq.profiles as { full_name?: string; phone?: string } | null;
                const tenantPhone = profile?.phone?.trim();
                const waLink = tenantPhone
                  ? whatsAppUrl(
                      tenantPhone,
                      `Hi, thanks for your inquiry on NyumbaSearch. I am ${provider.business_name}. How can I help you?`,
                    )
                  : null;
                return (
                  <li key={inq.id} className="rounded-xl border p-4 text-sm">
                    <p className="font-medium">{profile?.full_name ?? "Tenant"}</p>
                    <p className="mt-2 text-muted-foreground">{inq.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(inq.created_at).toLocaleString()}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {waLink ? (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          WhatsApp reply
                        </a>
                      ) : null}
                      {tenantPhone ? (
                        <a
                          href={`tel:${tenantPhone}`}
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        >
                          Call
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </PublicPageShell>
  );
}
