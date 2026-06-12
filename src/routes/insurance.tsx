import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { formatKes } from "@/lib/properties";
import { submitInquiry } from "@/lib/submit-inquiry";
import { useState } from "react";

export const Route = createFileRoute("/insurance")({
  head: () => ({ meta: [{ title: "Insurance — NyumbaSearch" }] }),
  component: InsurancePage,
});

function InsurancePage() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">Protect your home from day one</h1>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Tenant contents insurance</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Covers belongings against theft, fire, and water damage. From {formatKes(500)}/month.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Landlord property insurance</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Protect your building and rental income. From {formatKes(1200)}/month.
            </p>
          </div>
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
                inquiryType: "insurance",
                name: String(fd.get("name") ?? ""),
                phone: String(fd.get("phone") ?? ""),
                email: String(fd.get("email") ?? ""),
                subject: `Insurance quote — ${fd.get("propertyType")}`,
                message: `Property type: ${fd.get("propertyType")}\nLocation: ${fd.get("location")}\nEstimated value: ${fd.get("value")} KES`,
                metadata: {
                  propertyType: String(fd.get("propertyType") ?? ""),
                  location: String(fd.get("location") ?? ""),
                  valueKes: String(fd.get("value") ?? ""),
                },
              },
              "Quote request received. An advisor will contact you within 24 hours.",
            );
            setSubmitting(false);
            if (ok) e.currentTarget.reset();
          }}
        >
          <h2 className="font-semibold">Get a quote</h2>
          <input
            required
            name="propertyType"
            placeholder="Property type"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="location"
            placeholder="Location"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="value"
            placeholder="Estimated value (KES)"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="name"
            placeholder="Your name"
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
            type="email"
            name="email"
            placeholder="Email"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit quote request"}
          </button>
          <p className="text-[10px] text-muted-foreground">
            NyumbaSearch earns a referral commission. Your premium is not affected.
          </p>
        </form>
      </main>
    </PublicPageShell>
  );
}
