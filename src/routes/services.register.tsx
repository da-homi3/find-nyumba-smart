import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PublicPageShell } from "@/components/SiteNav";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import {
  createServiceProvider,
  getProviderDashboard,
  SERVICE_PROVIDER_CATEGORIES,
} from "@/lib/api/service-provider.functions";
import { PROVIDER_TIERS } from "@/lib/revenue/plans";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/services/register")({
  component: RegisterProviderPage,
});

type Step = "profile" | "plan" | "pay";

function RegisterProviderPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("profile");
  const [saving, setSaving] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [editingApplication, setEditingApplication] = useState(false);
  const [tier, setTier] = useState<(typeof PROVIDER_TIERS)[number]["value"]>("basic");
  const [form, setForm] = useState({
    businessName: "",
    categories: [] as string[],
    areasServed: "",
    description: "",
    phone: "",
    priceRange: "",
  });

  const { data: existing, isLoading: existingLoading } = useQuery({
    queryKey: ["provider-register", user?.id],
    enabled: !!user,
    queryFn: () => getProviderDashboard(),
  });

  useEffect(() => {
    const provider = existing?.provider;
    if (!provider || providerId) return;

    setProviderId(provider.id);
    setForm({
      businessName: provider.business_name ?? "",
      categories: Array.isArray(provider.categories) ? (provider.categories as string[]) : [],
      areasServed: Array.isArray(provider.areas_served)
        ? (provider.areas_served as string[]).join(", ")
        : "",
      description: provider.description ?? "",
      phone: provider.phone ?? "",
      priceRange: provider.price_range ?? "",
    });
    if (provider.tier === "featured" || provider.tier === "premium" || provider.tier === "basic") {
      setTier(provider.tier);
    }
  }, [existing?.provider, providerId]);

  if (loading || (user && existingLoading)) {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-lg px-5 py-16 text-sm text-muted-foreground">Loading…</div>
      </PublicPageShell>
    );
  }

  if (!user) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <h1 className="font-display text-2xl font-semibold">List your business</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to join the NyumbaSearch services directory.
          </p>
          <Link
            to="/auth"
            search={{ redirect: "/services/register" }}
            className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in to continue
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            New here?{" "}
            <Link to="/auth" search={{ redirect: "/services/register" }} className="text-primary">
              Create an account
            </Link>{" "}
            first, then return to this page.
          </p>
        </main>
      </PublicPageShell>
    );
  }

  if (existing?.provider?.status === "active") {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <h1 className="font-display text-2xl font-semibold">You&apos;re already listed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {existing.provider.business_name} is live on NyumbaSearch.
          </p>
          <Link
            to="/services/provider/dashboard"
            className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Open provider dashboard
          </Link>
        </main>
      </PublicPageShell>
    );
  }

  if (existing?.provider?.status === "pending" && !editingApplication && step === "profile") {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Approval waitlist
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Application submitted</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {existing.provider.business_name} is waiting for NyumbaSearch admin approval. You&apos;ll
            get an email when your listing is live and the provider dashboard unlocks.
          </p>
          <Link
            to="/services/provider/dashboard"
            className="mt-6 inline-flex rounded-xl border px-6 py-3 text-sm font-semibold"
          >
            Check waitlist status
          </Link>
          <button
            type="button"
            onClick={() => setEditingApplication(true)}
            className="mt-3 block w-full text-sm text-primary"
          >
            Edit application details
          </button>
        </main>
      </PublicPageShell>
    );
  }

  async function saveProfile() {
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
    setSaving(true);
    try {
      const res = await createServiceProvider({
        data: {
          businessName: form.businessName.trim(),
          categories: form.categories as (typeof SERVICE_PROVIDER_CATEGORIES)[number][],
          areasServed: areas,
          description: form.description.trim() || undefined,
          priceRange: form.priceRange.trim() || undefined,
          phone: form.phone.trim(),
        },
      });
      setProviderId(res.id);
      setEditingApplication(false);
      toast.success("Application submitted — waiting for admin approval");
      setStep("plan");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedTier = PROVIDER_TIERS.find((t) => t.value === tier)!;
  const defaultPhone =
    form.phone ||
    (user.user_metadata?.phone as string | undefined) ||
    (user.phone as string | undefined) ||
    "";

  if (step === "profile") {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12">
          <Link to="/services" className="text-sm text-primary">
            ← Services
          </Link>
          <h1 className="mt-4 font-display text-2xl font-semibold">List your business</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join electricians, plumbers, movers, and more on NyumbaSearch.
          </p>

          {existing?.provider?.status === "pending" && (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              You&apos;re on the approval waitlist. Update your details below if needed — an admin
              must approve you before your listing goes live.
            </p>
          )}
          {existing?.provider?.status === "rejected" && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              Your previous application was not approved. Update your details and submit again to
              rejoin the waitlist.
            </p>
          )}

          <div className="mt-8 grid gap-3">
            <input
              required
              placeholder="Business name"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <fieldset className="rounded-xl border p-3">
              <legend className="px-1 text-xs font-semibold text-muted-foreground">
                Categories
              </legend>
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
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>
            <input
              required
              placeholder="Areas served (comma separated, required)"
              value={form.areasServed}
              onChange={(e) => setForm({ ...form, areasServed: e.target.value })}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              required
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Price range (e.g. KES 1,500 – 5,000 per job)"
              value={form.priceRange}
              onChange={(e) => setForm({ ...form, priceRange: e.target.value })}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <textarea
              placeholder="Tell tenants what you do"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-24 rounded-xl border px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProfile()}
              className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : "Continue to plans"}
            </button>
          </div>
        </main>
      </PublicPageShell>
    );
  }

  if (step === "plan") {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12">
          <button type="button" onClick={() => setStep("profile")} className="text-sm text-primary">
            ← Edit profile
          </button>
          <h1 className="mt-4 font-display text-2xl font-semibold">Choose a plan</h1>
          <p className="mt-2 text-sm text-emerald-600">
            Your first month is free for new subscribers — no payment collected today.
          </p>
          <div className="mt-8 grid gap-3">
            {PROVIDER_TIERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTier(t.value);
                  setStep("pay");
                }}
                className="rounded-2xl border p-4 text-left hover:border-primary"
              >
                <p className="font-semibold">
                  {t.label} — KES {t.priceKes.toLocaleString()}/mo
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        </main>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-lg px-5 py-12">
        <button type="button" onClick={() => setStep("plan")} className="text-sm text-primary">
          ← Change plan
        </button>
        <h1 className="mt-4 font-display text-2xl font-semibold">Choose your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start your free trial for {selectedTier.label}. Your listing stays on the admin waitlist
          until NyumbaSearch approves your application — then it goes live.
        </p>
        <div className="mt-8">
          <CheckoutFlow
            checkoutPath="/services/register"
            lineItem={{
              title: `${selectedTier.label} provider plan`,
              subtitle: selectedTier.desc,
              amountKes: selectedTier.priceKes,
            }}
            metadata={{
              paymentType: "provider_subscription",
              plan: tier,
              providerId: providerId ?? undefined,
            }}
            defaultPhone={defaultPhone}
            allowQuarterly={false}
            onSuccess={() => {
              toast.success("Plan saved — waiting for admin approval");
              navigate({ to: "/services/provider/dashboard" });
            }}
          />
        </div>
      </main>
    </PublicPageShell>
  );
}
