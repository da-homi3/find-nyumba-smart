import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { formatKes } from "@/lib/properties";
import { submitInquiry } from "@/lib/submit-inquiry";
import { ADVERTISE_PACKAGES } from "@/lib/revenue/plans";
import { formFieldValue } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/advertise")({
  head: () => ({ meta: [{ title: "Advertise — NyumbaSearch" }] }),
  component: AdvertisePage,
});

function AdvertisePage() {
  const [submitting, setSubmitting] = useState(false);
  const [packageId, setPackageId] = useState<(typeof ADVERTISE_PACKAGES)[number]["id"]>("banner");

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">
          Reach Nairobi&apos;s most active home movers
        </h1>
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
                <th className="p-4">Price</th>
              </tr>
            </thead>
            <tbody>
              {ADVERTISE_PACKAGES.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-4 font-medium">{row.name}</td>
                  <td className="p-4 text-muted-foreground">{row.placement}</td>
                  <td className="p-4 font-semibold">{formatKes(row.priceKes)}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="mt-10 grid gap-3 rounded-2xl border bg-card p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            const fd = new FormData(e.currentTarget);
            const email = formFieldValue(fd, "email").trim();
            const phone = formFieldValue(fd, "phone").trim();
            const company = formFieldValue(fd, "company");
            setSubmitting(true);
            const ok = await submitInquiry(
              {
                inquiryType: "advertise",
                name: formFieldValue(fd, "contactName"),
                phone: phone || undefined,
                email: email || undefined,
                company,
                subject: `Advertising inquiry — ${company}`,
                message: formFieldValue(fd, "goal", "Advertising inquiry"),
                metadata: {
                  package: packageId,
                  budget: formFieldValue(fd, "budget"),
                  contact: email || phone,
                },
              },
              "Approved — check your email for the payment link to activate your campaign.",
            );
            setSubmitting(false);
            if (ok) e.currentTarget.reset();
          }}
        >
          <h2 className="font-semibold">Advertise with us</h2>
          <input
            required
            name="company"
            placeholder="Company name"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="contactName"
            placeholder="Contact name"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            name="email"
            placeholder="Email (for approval & payment link)"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="Phone (optional)"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Package</span>
            <select
              value={packageId}
              onChange={(e) =>
                setPackageId(e.target.value as (typeof ADVERTISE_PACKAGES)[number]["id"])
              }
              className="rounded-xl border px-3 py-2"
            >
              {ADVERTISE_PACKAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatKes(p.priceKes)}/mo
                </option>
              ))}
            </select>
          </label>
          <input
            name="budget"
            placeholder="Budget range (optional)"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <textarea
            name="goal"
            required
            placeholder="Campaign goal"
            rows={3}
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit inquiry"}
          </button>
        </form>
      </main>
    </PublicPageShell>
  );
}
