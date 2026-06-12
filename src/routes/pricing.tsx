import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PublicPageShell } from "@/components/SiteNav";
import { PlanCards } from "@/components/PlanCards";
import { AGENCY_PLANS, BOOST_PACKAGES, LANDLORD_PLANS, PLUS_PLAN } from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — NyumbaSearch" }] }),
  component: PricingPage,
});

const FAQ = [
  {
    q: "Can I cancel my plan anytime?",
    a: "Yes, cancel before your next billing date with no penalty.",
  },
  {
    q: "How does M-Pesa payment work?",
    a: "You'll receive an STK push to your registered M-Pesa number. Confirm the prompt to activate your plan immediately.",
  },
  {
    q: "What payment methods do you accept?",
    a: "M-Pesa (primary), Visa/Mastercard, and bank transfer for Enterprise plans.",
  },
  {
    q: "How does the free plan work?",
    a: "Free forever for one listing. Upgrade when you need more.",
  },
  {
    q: "What is property verification?",
    a: "Our team physically confirms the property exists, is vacant, and matches the listing. Verified properties get a badge that increases tenant trust.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes. Upgrades take effect immediately (prorated). Downgrades take effect at the next billing cycle.",
  },
];

function PricingPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-12">
        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold">Simple, honest pricing</h1>
          <p className="mt-3 text-muted-foreground">
            No agent fees for tenants. Landlords pay only when they need more reach.
          </p>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Individual landlords</h2>
          <div className="mt-6">
            <PlanCards plans={LANDLORD_PLANS} />
          </div>
        </section>

        <section id="agencies" className="mt-20 scroll-mt-8">
          <h2 className="font-display text-2xl font-semibold">For agencies & property managers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Team dashboards, lead management, and priority placement.
          </p>
          <div className="mt-6">
            <PlanCards plans={AGENCY_PLANS} />
          </div>
        </section>

        <section id="boost" className="mt-20 scroll-mt-8">
          <h2 className="font-display text-2xl font-semibold">Boost individual properties</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-left">
                  <th className="p-4 font-semibold">Package</th>
                  <th className="p-4 font-semibold">Placement</th>
                  <th className="p-4 font-semibold">Duration</th>
                  <th className="p-4 font-semibold">Price</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {BOOST_PACKAGES.map((pkg) => (
                  <tr key={pkg.id} className="border-b">
                    <td className="p-4 font-medium">{pkg.name}</td>
                    <td className="p-4 text-muted-foreground">{pkg.placement}</td>
                    <td className="p-4">{pkg.durationDays} days</td>
                    <td className="p-4 font-semibold">
                      {pkg.priceRange ?? formatKes(pkg.priceKes)}
                    </td>
                    <td className="p-4">
                      <a
                        href={`/landlord/boost?package=${pkg.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Boost this listing
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="plus" className="mt-20 scroll-mt-8">
          <h2 className="font-display text-2xl font-semibold">For serious house hunters</h2>
          <div className="mt-6 rounded-2xl border bg-card p-6 shadow-soft">
            <h3 className="font-display text-xl font-semibold">NyumbaSearch Plus</h3>
            <p className="mt-1 font-semibold text-primary">
              {formatKes(PLUS_PLAN.monthlyKes)} / month · {formatKes(PLUS_PLAN.quarterlyKes)} / 3
              months
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {PLUS_PLAN.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <a
              href="/tenant/checkout?plan=plus"
              className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Go Plus
            </a>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold">FAQ</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}

function FaqItem({ q, a }: Readonly<{ q: string; a: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold"
      >
        {q}
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="border-t px-4 pb-4 pt-2 text-sm text-muted-foreground">{a}</p>}
    </div>
  );
}
