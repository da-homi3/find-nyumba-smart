import { createFileRoute, Link } from "@tanstack/react-router";
import { PlanCards } from "@/components/PlanCards";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — NyumbaSearch" }] }),
  component: PricingPage,
});

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Landlord Pro and Agency plans cancel at the end of your billing period — no lock-in.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan is always free. Pro includes a 14-day trial when you upgrade from the dashboard.",
  },
  {
    q: "What payment methods do you accept?",
    a: "M-Pesa STK push is primary. Card payments via Paystack coming soon.",
  },
  {
    q: "How does verification work?",
    a: "Landlords verify phone, ID, business, and ownership in stages. Tenants see Level 1–4 badges on every listing.",
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-secondary/40 px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="font-display text-lg font-semibold">
            NyumbaSearch
          </Link>
          <Link to="/landlord" className="text-sm font-semibold text-primary">
            Landlord portal →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-16">
        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold">Simple, honest pricing</h1>
          <p className="mt-3 text-muted-foreground">
            No agent fees for tenants. Landlords pay only when they need more reach.
          </p>
        </div>

        <div className="mt-12">
          <PlanCards />
        </div>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold">Compare plans</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-left">
                  <th className="p-4 font-semibold">Feature</th>
                  <th className="p-4">Free</th>
                  <th className="p-4">Pro</th>
                  <th className="p-4">Agency</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Listings", "1", "10", "Unlimited"],
                  ["Analytics", "Basic", "Full", "Full + export"],
                  ["Featured slot", "—", "1/mo", "3/mo"],
                  ["Multi-user", "—", "—", "Yes"],
                  ["API access", "—", "—", "Yes"],
                ].map(([f, ...cols]) => (
                  <tr key={f} className="border-b">
                    <td className="p-4 font-medium">{f}</td>
                    {cols.map((c, i) => (
                      <td key={i} className="p-4 text-muted-foreground">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
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
