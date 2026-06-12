import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { formatKes } from "@/lib/properties";
import { submitInquiry } from "@/lib/submit-inquiry";
import { useState } from "react";

export const Route = createFileRoute("/advertise")({
  head: () => ({ meta: [{ title: "Advertise — NyumbaSearch" }] }),
  component: AdvertisePage,
});

function AdvertisePage() {
  const [submitting, setSubmitting] = useState(false);

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
                <th className="p-4">Impressions</th>
                <th className="p-4">Price</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Banner ads", "Homepage + browse", "~10,000/month", 5000],
                ["Featured content", "Property detail pages", "~5,000/month", 15000],
                ["Newsletter inclusion", "Weekly tenant email", "~8,000 opens", 10000],
                ["Full campaign", "All placements", "~30,000/month", 50000],
              ].map(([pkg, place, imp, price]) => (
                <tr key={pkg as string} className="border-b">
                  <td className="p-4 font-medium">{pkg}</td>
                  <td className="p-4 text-muted-foreground">{place}</td>
                  <td className="p-4">{imp}</td>
                  <td className="p-4 font-semibold">{formatKes(price as number)}/mo</td>
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
            setSubmitting(true);
            const ok = await submitInquiry(
              {
                inquiryType: "advertise",
                name: String(fd.get("contactName") ?? ""),
                phone: String(fd.get("contact") ?? ""),
                company: String(fd.get("company") ?? ""),
                subject: `Advertising inquiry — ${fd.get("company")}`,
                message: String(fd.get("goal") ?? "Advertising inquiry"),
                metadata: {
                  budget: String(fd.get("budget") ?? ""),
                  contact: String(fd.get("contact") ?? ""),
                },
              },
              "Thanks — our partnerships team will contact you within 1 business day.",
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
            name="contact"
            placeholder="Phone / email"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            name="budget"
            placeholder="Budget range"
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
