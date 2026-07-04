import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { formatKes } from "@/lib/properties";
import { submitInquiry } from "@/lib/submit-inquiry";
import { ADVERTISE_PACKAGES, type AdvertisePackageId } from "@/lib/revenue/plans";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/advertise")({
  head: () => ({ meta: [{ title: "Advertise — NyumbaSearch" }] }),
  component: AdvertisePage,
});

const BUDGET_OPTIONS = [
  { value: "5000-10000", label: "KES 5,000 – 10,000" },
  { value: "10000-25000", label: "KES 10,000 – 25,000" },
  { value: "25000-50000", label: "KES 25,000 – 50,000" },
  { value: "50000+", label: "KES 50,000+" },
] as const;

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  adType: AdvertisePackageId | "";
  budget: string;
  message: string;
};

const emptyForm: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  adType: "",
  budget: "",
  message: "",
};

function AdvertisePage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !form.adType) return;
    setSubmitting(true);
    const ok = await submitInquiry(
      {
        inquiryType: "advertise",
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: `Advertising inquiry — ${form.company.trim()}`,
        message: form.message.trim(),
        metadata: {
          package: form.adType,
          budget: form.budget,
          website: form.website.trim(),
          contact: form.email.trim(),
        },
      },
      "Enquiry received — check your email for confirmation. We'll reply within 24 hours.",
    );
    setSubmitting(false);
    if (ok) setSubmitted(true);
  }

  if (submitted) {
    const firstName = form.name.trim().split(/\s+/)[0] || "there";
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-16 text-center">
          <h1 className="font-display text-3xl font-semibold">Enquiry received!</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Thanks {firstName}! We&apos;ve sent the details to our team. You&apos;ll receive a
            response at <strong className="text-foreground">{form.email}</strong> within 24 hours
            with a personalised ad package proposal and payment link.
          </p>
        </main>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">Advertise with NyumbaSearch</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Reach thousands of verified home-seekers in Nairobi every day. Fill out the form and
          we&apos;ll send you a tailored proposal within 24 hours.
        </p>
        <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-sm">
          50,000+ monthly active tenants · 8 minutes average session · High-intent audience actively
          spending on home services
        </p>

        <div className="mt-10 overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left">
                <th className="p-4">Package</th>
                <th className="p-4">Placement</th>
                <th className="p-4">From</th>
              </tr>
            </thead>
            <tbody>
              {ADVERTISE_PACKAGES.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-4 font-medium">{row.name}</td>
                  <td className="p-4 text-muted-foreground">{row.placement}</td>
                  <td className="p-4 font-semibold">
                    {row.id === "custom" ? "Custom" : `${formatKes(row.priceKes)}/mo`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="mt-10 grid gap-3 rounded-2xl border bg-card p-6" onSubmit={handleSubmit}>
          <h2 className="font-semibold">Send an enquiry</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Full name"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <input
              required
              value={form.company}
              onChange={(e) => setField("company", e.target.value)}
              placeholder="Company / Business name"
              className="rounded-xl border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="Email address"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="Phone (WhatsApp preferred)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
          </div>
          <input
            type="url"
            value={form.website}
            onChange={(e) => setField("website", e.target.value)}
            placeholder="Website or social media (optional)"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Ad type interested in</span>
            <select
              required
              value={form.adType}
              onChange={(e) => setField("adType", e.target.value as AdvertisePackageId | "")}
              className="rounded-xl border px-3 py-2"
            >
              <option value="">Select an option</option>
              {ADVERTISE_PACKAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === "custom" ? "" : ` (KES ${p.priceKes.toLocaleString()}/mo)`}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Monthly budget (KES)</span>
            <select
              value={form.budget}
              onChange={(e) => setField("budget", e.target.value)}
              className="rounded-xl border px-3 py-2"
            >
              <option value="">Select budget range</option>
              {BUDGET_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <textarea
            required
            value={form.message}
            onChange={(e) => setField("message", e.target.value)}
            placeholder="What do you sell or offer? Who are your target customers? What results are you hoping for?"
            rows={5}
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send enquiry"}
          </button>
        </form>
      </main>
    </PublicPageShell>
  );
}
