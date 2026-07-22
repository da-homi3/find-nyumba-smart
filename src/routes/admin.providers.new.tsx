import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import {
  adminCreateServiceProvider,
  SERVICE_PROVIDER_CATEGORIES,
} from "@/lib/api/service-provider.functions";
import { PROVIDER_COUNTIES } from "@/lib/provider-counties";
import { PROVIDER_TIERS } from "@/lib/revenue/plans";
import { buildPageHead } from "@/lib/seo/head";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/providers/new")({
  head: () =>
    buildPageHead({
      title: "Add service provider — Admin",
      description: "Upload a service provider to the NyumbaSearch directory.",
      path: "/admin/providers/new",
      noIndex: true,
    }),
  component: () => (
    <RouteErrorBoundary title="Admin provider upload failed to load">
      <AdminCreateProviderPage />
    </RouteErrorBoundary>
  ),
});

const inputCls =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function categoryLabel(slug: string): string {
  return slug.replaceAll("_", " ");
}

function AdminCreateProviderPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    categories: [] as string[],
    areasServed: "",
    counties: ["nairobi"] as string[],
    description: "",
    phone: "",
    priceRange: "",
    sourceUrl: "",
    tier: "basic" as (typeof PROVIDER_TIERS)[number]["value"],
    verified: false,
  });

  function toggleCategory(slug: string) {
    setForm((prev) => {
      const has = prev.categories.includes(slug);
      return {
        ...prev,
        categories: has
          ? prev.categories.filter((c) => c !== slug)
          : [...prev.categories, slug],
      };
    });
  }

  function toggleCounty(code: string) {
    setForm((prev) => {
      const has = prev.counties.includes(code);
      const next = has ? prev.counties.filter((c) => c !== code) : [...prev.counties, code];
      return { ...prev, counties: next.length > 0 ? next : ["nairobi"] };
    });
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const areas = form.areasServed
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (!form.businessName.trim() || form.categories.length === 0 || areas.length === 0) {
      toast.error("Business name, at least one category, and areas served are required");
      return;
    }
    if (!form.phone.trim() && !form.sourceUrl.trim()) {
      toast.error("Add a phone number or website URL");
      return;
    }

    setSaving(true);
    try {
      const res = await adminCreateServiceProvider({
        data: {
          businessName: form.businessName.trim(),
          categories: form.categories as (typeof SERVICE_PROVIDER_CATEGORIES)[number][],
          areasServed: areas,
          counties: form.counties,
          description: form.description.trim() || undefined,
          priceRange: form.priceRange.trim() || undefined,
          phone: form.phone.trim() || undefined,
          sourceUrl: form.sourceUrl.trim() || undefined,
          tier: form.tier,
          verified: form.verified,
        },
      });
      toast.success("Service provider listed");
      void navigate({
        to: "/services/provider/$id",
        params: { id: res.id },
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              to="/admin"
              search={{ tab: "providers" }}
              aria-label="Back to admin"
              className="shrink-0 rounded-full p-1.5 hover:bg-secondary"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div className="shrink-0 rounded-lg bg-white px-2 py-1 shadow-sm">
              <BrandLogo logoClassName="h-6" />
            </div>
            <h1 className="truncate font-display text-lg font-bold sm:text-xl">
              Add service provider
            </h1>
          </div>
          <DashboardSettingsLink variant="pill" />
        </div>
      </header>

      <form onSubmit={onSubmit} className="mx-auto mt-6 max-w-3xl space-y-6 px-4 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Upload a directory listing that goes live immediately (no applicant account required).
        </p>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold">Business name</span>
          <input
            required
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            className={inputCls}
            placeholder="BestCare Plumbing"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold">Categories</legend>
          <div className="flex flex-wrap gap-2">
            {SERVICE_PROVIDER_CATEGORIES.map((slug) => {
              const active = form.categories.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleCategory(slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                    active ? "border-primary bg-primary/10 text-primary" : ""
                  }`}
                >
                  {categoryLabel(slug)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold">
            Areas served (comma-separated)
          </span>
          <input
            required
            value={form.areasServed}
            onChange={(e) => setForm((f) => ({ ...f, areasServed: e.target.value }))}
            className={inputCls}
            placeholder="Kilimani, Westlands, Lavington"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold">Counties</legend>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_COUNTIES.map((county) => {
              const active = form.counties.includes(county.code);
              return (
                <button
                  key={county.code}
                  type="button"
                  onClick={() => toggleCounty(county.code)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    active ? "border-primary bg-primary/10 text-primary" : ""
                  }`}
                >
                  {county.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">Phone</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={inputCls}
              placeholder="0712 345 678"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">Website URL</span>
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              className={inputCls}
              placeholder="https://example.com"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">Price range</span>
            <input
              value={form.priceRange}
              onChange={(e) => setForm((f) => ({ ...f, priceRange: e.target.value }))}
              className={inputCls}
              placeholder="From KES 2,000"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">Listing tier</span>
            <select
              value={form.tier}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tier: e.target.value as (typeof PROVIDER_TIERS)[number]["value"],
                }))
              }
              className={inputCls}
            >
              {PROVIDER_TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold">Description</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={inputCls}
            placeholder="What this business offers…"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.verified}
            onChange={(e) => setForm((f) => ({ ...f, verified: e.target.checked }))}
            className="accent-primary"
          />
          <span>Mark as verified</span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Publishing…" : "Publish provider"}
          </button>
          <Link
            to="/admin"
            search={{ tab: "providers" }}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
