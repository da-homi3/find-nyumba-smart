import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Eye,
  MessageSquare,
  MousePointerClick,
  Phone,
  Save,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { ViewsOverTimeChart, BrandBarChart } from "@/components/dashboard/AnalyticsChart";
import { AnimatedStat } from "@/components/motion/AnimatedStat";
import {
  SERVICE_PROVIDER_CATEGORIES,
  updateServiceProviderProfile,
  type ProviderAnalyticsSummary,
  type ProviderProfileInput,
} from "@/lib/api/service-provider.functions";
import { PROVIDER_TIERS, providerTierPrice } from "@/lib/revenue/plans";
import { PROVIDER_COUNTIES } from "@/lib/provider-counties";
import { formatKes } from "@/lib/properties";
import { whatsAppUrl } from "@/lib/phone";
import { cn, errorMessage } from "@/lib/utils";

type ProviderRow = {
  id: string;
  business_name: string;
  categories: unknown;
  areas_served: unknown;
  counties?: unknown;
  description: string | null;
  price_range: string | null;
  phone: string | null;
  source_url?: string | null;
  tier: string;
  status: string;
};

type InquiryRow = {
  id: string;
  message: string;
  created_at: string;
  profiles: { full_name?: string; phone?: string } | null;
};

type SubscriptionRow = {
  status?: string;
  plan?: string;
  trial_end?: string | null;
} | null;

export type ProviderDashboardTab = "overview" | "profile" | "pricing" | "inquiries" | "plan";

export const PROVIDER_DASHBOARD_TABS: { id: ProviderDashboardTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Business profile" },
  { id: "pricing", label: "Pricing" },
  { id: "inquiries", label: "Inquiries" },
  { id: "plan", label: "Plan" },
];

export function ProviderDashboardTabs({
  active,
  onChange,
}: Readonly<{
  active: ProviderDashboardTab;
  onChange: (tab: ProviderDashboardTab) => void;
}>) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-secondary/30 p-1">
      {PROVIDER_DASHBOARD_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm",
            active === tab.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function providerToForm(provider: ProviderRow) {
  return {
    businessName: provider.business_name ?? "",
    categories: Array.isArray(provider.categories) ? (provider.categories as string[]) : [],
    areasServed: Array.isArray(provider.areas_served)
      ? (provider.areas_served as string[]).join(", ")
      : "",
    counties: Array.isArray(provider.counties) ? (provider.counties as string[]) : ["Nairobi"],
    description: provider.description ?? "",
    phone: provider.phone ?? "",
    priceRange: provider.price_range ?? "",
    sourceUrl: provider.source_url ?? "",
  };
}

export function ProviderOverviewPanel({
  analytics,
  provider,
  subscription,
}: Readonly<{
  analytics: ProviderAnalyticsSummary;
  provider: ProviderRow;
  subscription: SubscriptionRow;
}>) {
  const eventLabels: Record<string, string> = {
    profile_view: "Profile views",
    directory_view: "Directory views",
    contact_click: "Contact clicks",
    quote_request: "Quote requests",
  };

  const chartData = analytics.eventsByType.map((e) => ({
    label: eventLabels[e.type] ?? e.type,
    count: e.count,
  }));

  const trialDaysLeft =
    subscription?.status === "trialing" && subscription.trial_end
      ? Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / 86400000)
      : null;

  return (
    <div className="space-y-6">
      {trialDaysLeft !== null && trialDaysLeft > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left, then{" "}
          {formatKes(providerTierPrice(subscription?.plan ?? provider.tier))}/mo
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Eye} label="Profile views" value={analytics.profileViews} />
        <StatCard icon={BarChart3} label="Directory views" value={analytics.directoryViews} />
        <StatCard icon={MousePointerClick} label="Contact clicks" value={analytics.contactClicks} />
        <StatCard icon={MessageSquare} label="Quote requests" value={analytics.quoteRequests} />
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Conversion rate</h2>
        </div>
        <p className="mt-2 font-display text-3xl font-semibold text-primary">
          {analytics.conversionRate}%
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Quote requests ÷ profile views (last 30 days)
        </p>
      </div>

      {analytics.viewsByDay.length > 0 ? (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Activity (30 days)</h2>
          <div className="mt-4">
            <ViewsOverTimeChart data={analytics.viewsByDay} />
          </div>
        </div>
      ) : null}

      {chartData.some((d) => d.count > 0) ? (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Events by type</h2>
          <div className="mt-4">
            <BrandBarChart data={chartData} xKey="label" yKey="count" height={200} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-secondary/20 p-8 text-center">
          <p className="font-display font-semibold">Analytics will appear here</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Once tenants view your listing and request quotes, you&apos;ll see trends and conversion
            data.
          </p>
        </div>
      )}

      <div className="rounded-2xl border bg-secondary/30 p-5 text-sm">
        <p className="font-semibold">Quick links</p>
        <p className="mt-2 text-muted-foreground">
          Your public listing:{" "}
          <Link
            to="/services/provider/$id"
            params={{ id: provider.id }}
            className="font-medium text-primary hover:underline"
          >
            View profile →
          </Link>
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: Readonly<{ icon: typeof Eye; label: string; value: number }>) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <div className="mt-2">
        <AnimatedStat value={value} label={label} ready />
      </div>
    </div>
  );
}

export function ProviderProfilePanel({ provider }: Readonly<{ provider: ProviderRow }>) {
  const queryClient = useQueryClient();
  const initial = providerToForm(provider);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const areas = form.areasServed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!form.businessName.trim() || form.categories.length === 0 || !form.phone.trim()) {
      toast.error("Business name, at least one category, and phone are required");
      return;
    }
    if (areas.length === 0) {
      toast.error("Enter at least one area you serve");
      return;
    }
    if (form.counties.length === 0) {
      toast.error("Select at least one county");
      return;
    }

    setSaving(true);
    try {
      const payload: ProviderProfileInput = {
        businessName: form.businessName.trim(),
        categories: form.categories as ProviderProfileInput["categories"],
        areasServed: areas,
        counties: form.counties,
        description: form.description.trim() || undefined,
        priceRange: form.priceRange.trim() || undefined,
        phone: form.phone.trim(),
        sourceUrl: form.sourceUrl.trim() || undefined,
      };
      await updateServiceProviderProfile({ data: payload });
      await queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Keep your listing accurate so tenants find you in search and county filters.
      </p>
      <div className="grid gap-3">
        <Field label="Business name">
          <input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </Field>
        <fieldset className="rounded-xl border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Categories</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_PROVIDER_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm capitalize">
                <input
                  type="checkbox"
                  checked={form.categories.includes(c)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categories: e.target.checked
                        ? [...form.categories, c]
                        : form.categories.filter((x) => x !== c),
                    })
                  }
                />
                {c.replaceAll("_", " ")}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="rounded-xl border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">
            Counties served
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROVIDER_COUNTIES.map((c) => (
              <label key={c.code} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.counties.includes(c.name)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      counties: e.target.checked
                        ? [...form.counties, c.name]
                        : form.counties.filter((x) => x !== c.name),
                    })
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Areas served (comma separated)">
          <input
            value={form.areasServed}
            onChange={(e) => setForm({ ...form, areasServed: e.target.value })}
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </Field>
        <Field label="Website (optional)">
          <input
            placeholder="https://yourbusiness.co.ke"
            value={form.sourceUrl}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </Field>
        <Field label="About your business">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="min-h-28 w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </Field>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

export function ProviderPricingPanel({ provider }: Readonly<{ provider: ProviderRow }>) {
  const queryClient = useQueryClient();
  const [priceRange, setPriceRange] = useState(provider.price_range ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const areas = Array.isArray(provider.areas_served)
      ? (provider.areas_served as string[])
      : ["Nairobi"];
    const categories = Array.isArray(provider.categories) ? (provider.categories as string[]) : [];
    const counties = Array.isArray(provider.counties)
      ? (provider.counties as string[])
      : ["Nairobi"];

    setSaving(true);
    try {
      await updateServiceProviderProfile({
        data: {
          businessName: provider.business_name,
          categories: categories as ProviderProfileInput["categories"],
          areasServed: areas,
          counties,
          description: provider.description ?? undefined,
          priceRange: priceRange.trim() || undefined,
          phone: provider.phone ?? "",
          sourceUrl: provider.source_url ?? undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
      toast.success("Pricing updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set how you price jobs. Tenants see a starting price parsed from this field on your public
        listing.
      </p>
      <div className="rounded-2xl border bg-secondary/30 p-4 text-sm">
        <p className="font-semibold">Current listing tier</p>
        <p className="mt-1 capitalize text-muted-foreground">
          {provider.tier} — platform fee {formatKes(providerTierPrice(provider.tier))}/mo
        </p>
      </div>
      <Field label="Price range shown to tenants">
        <input
          placeholder="e.g. From KES 1,500 per job or KES 2,500 – 8,000 per move"
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          className="w-full rounded-xl border px-3 py-2.5 text-sm"
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Tip: include &quot;From KES X&quot; so tenants see a clear starting price. Use &quot;Quote
        on request&quot; for custom jobs.
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save pricing"}
      </button>
    </div>
  );
}

export function ProviderInquiriesPanel({
  provider,
  inquiries,
}: Readonly<{ provider: ProviderRow; inquiries: InquiryRow[] }>) {
  if (inquiries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-secondary/20 p-8 text-center">
        <p className="font-display font-semibold">No inquiries yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          When tenants request quotes from your listing, they&apos;ll appear here with contact
          details.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {inquiries.map((inq) => {
        const profile = inq.profiles;
        const tenantPhone = profile?.phone?.trim();
        const waLink = tenantPhone
          ? whatsAppUrl(
              tenantPhone,
              `Hi, thanks for your inquiry on NyumbaSearch. I am ${provider.business_name}. How can I help you?`,
            )
          : null;
        return (
          <li key={inq.id} className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">{profile?.full_name ?? "Tenant"}</p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{inq.message}</p>
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
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ProviderPlanPanel({
  provider,
  subscription,
  defaultPhone,
}: Readonly<{
  provider: ProviderRow;
  subscription: SubscriptionRow;
  defaultPhone: string;
}>) {
  const [tier, setTier] = useState(provider.tier as "basic" | "featured" | "premium");
  const selectedTier = PROVIDER_TIERS.find((t) => t.value === tier)!;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-secondary/30 p-4 text-sm">
        <p className="font-semibold">Current plan</p>
        <p className="mt-1 capitalize">
          {provider.tier} — {subscriptionStatusLabel(subscription?.status)}
        </p>
      </div>

      <div className="grid gap-3">
        {PROVIDER_TIERS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTier(t.value)}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              tier === t.value ? "border-primary bg-primary/5" : "hover:border-primary/40",
            )}
          >
            <p className="font-semibold">
              {t.label} — {formatKes(t.priceKes)}/mo
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
          </button>
        ))}
      </div>

      {tier !== provider.tier ? (
        <div className="rounded-2xl border p-5">
          <h3 className="font-display font-semibold">Upgrade to {selectedTier.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{selectedTier.desc}</p>
          <div className="mt-6">
            <CheckoutFlow
              checkoutPath="/services/provider/dashboard"
              lineItem={{
                title: `${selectedTier.label} provider plan`,
                subtitle: selectedTier.desc,
                amountKes: selectedTier.priceKes,
              }}
              metadata={{
                paymentType: "provider_subscription",
                plan: tier,
                providerId: provider.id,
              }}
              defaultPhone={defaultPhone}
              allowQuarterly={false}
              onSuccess={() => toast.success("Plan updated")}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You&apos;re on the {selectedTier.label} plan. Select a different tier above to change.
        </p>
      )}
    </div>
  );
}

function subscriptionStatusLabel(status: string | undefined): string {
  if (status === "active") return "Active";
  if (status === "trialing") return "Free trial";
  return "No active subscription";
}

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
