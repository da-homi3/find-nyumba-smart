import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { submitInquiry } from "@/lib/submit-inquiry";
import { useState } from "react";

export const Route = createFileRoute("/services/register")({
  component: RegisterProviderPage,
});

function RegisterProviderPage() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-lg px-5 py-12">
        <Link to="/services" className="text-sm text-primary">
          ← Services
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold">Join the marketplace</h1>
        <form
          className="mt-8 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            const fd = new FormData(e.currentTarget);
            setSubmitting(true);
            const ok = await submitInquiry(
              {
                inquiryType: "service_register",
                name: String(fd.get("business") ?? ""),
                phone: String(fd.get("phone") ?? ""),
                email: String(fd.get("email") ?? ""),
                company: String(fd.get("business") ?? ""),
                subject: `Provider application — ${fd.get("business")}`,
                message: `Category: ${fd.get("category")}\nAreas: ${fd.get("areas")}\nYears: ${fd.get("years")}`,
                metadata: {
                  category: String(fd.get("category") ?? ""),
                  areas: String(fd.get("areas") ?? ""),
                  years: String(fd.get("years") ?? ""),
                },
              },
              "Application received. We'll review and contact you within 48 hours.",
            );
            setSubmitting(false);
            if (ok) e.currentTarget.reset();
          }}
        >
          <input
            required
            name="business"
            placeholder="Business name"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <select name="category" required className="rounded-xl border px-3 py-2 text-sm">
            <option value="">Category</option>
            <option value="plumber">Plumber</option>
            <option value="electrician">Electrician</option>
            <option value="mover">Mover</option>
          </select>
          <input
            name="areas"
            placeholder="Areas served"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            name="years"
            placeholder="Years in business"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="phone"
            placeholder="Phone"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="email"
            type="email"
            placeholder="Email"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            KES 2,000/month subscription or KES 150 per verified customer request.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit application"}
          </button>
        </form>
      </main>
    </PublicPageShell>
  );
}
