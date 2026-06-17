import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import {
  AGENCY_PLANS,
  BOOST_PACKAGES,
  LANDLORD_PLANS,
  PLUS_PLAN,
  REPORT_CATALOG,
  planPriceLabel,
} from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — NyumbaSearch" },
      {
        name: "description",
        content:
          "Landlord plans, agency tiers, listing boosts, NyumbaSearch Plus, and market reports. Pay with M-Pesa — card also available.",
      },
    ],
  }),
  component: PricingPage,
});

const FAQ = [
  {
    q: "How does M-Pesa payment work?",
    a: "M-Pesa is the default at checkout. Enter your Safaricom number and tap Send M-Pesa prompt — you'll get an STK Push on your phone. Enter your PIN and NyumbaSearch confirms payment automatically within seconds. No paybill or till number needed.",
  },
  {
    q: "Can I pay with a card instead?",
    a: "Yes. Expand Pay with card instead at checkout to use Pesapal (Visa/Mastercard). M-Pesa remains the recommended option for fastest confirmation.",
  },
  {
    q: "Do subscriptions renew automatically?",
    a: "Card subscriptions renew via M-Pesa STK Push to your phone before your billing date. M-Pesa subscriptions work the same way. If a renewal fails, you get a 3-day grace period before your plan downgrades.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Landlords can list one verified property on the Free plan. Tenants can search and browse at no cost — NyumbaSearch Plus is optional for power searchers.",
  },
];

function PlanGrid({
  title,
  plans,
}: Readonly<{
  title: string;
  plans: typeof LANDLORD_PLANS;
}>) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border bg-card p-5 ${plan.highlighted ? "border-primary ring-2 ring-primary/20" : ""}`}
          >
            {plan.badge && (
              <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {plan.badge}
              </span>
            )}
            <h3 className="font-semibold">{plan.name}</h3>
            <p className="mt-1 text-2xl font-display text-primary">
              {planPriceLabel(plan)}
              <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {plan.features.slice(0, 4).map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <Link
              to={plan.ctaTo}
              className="mt-5 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground"
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-6xl px-5 py-16">
        <h1 className="font-display text-4xl font-semibold">Simple, transparent pricing</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pay with M-Pesa (recommended) or card. No agent fees for tenants. Landlords only pay when
          they want more visibility or capacity.
        </p>

        <PlanGrid title="Landlord plans" plans={LANDLORD_PLANS} />
        <div id="agencies" className="scroll-mt-24">
          <PlanGrid title="Agency plans" plans={AGENCY_PLANS} />
        </div>

        <section id="boost" className="mt-14 scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold">Listing boosts</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {BOOST_PACKAGES.map((b) => (
              <Link
                key={b.id}
                to="/landlord/boost"
                search={{ package: b.id }}
                className="rounded-2xl border bg-card p-5 transition hover:border-primary"
              >
                <h3 className="font-semibold">{b.name}</h3>
                <p className="mt-1 text-lg text-primary">{formatKes(b.priceKes)}</p>
                <p className="text-xs text-muted-foreground">
                  {b.durationDays} days · {b.placement}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-2">
          <div id="plus" className="scroll-mt-24 rounded-2xl border bg-card p-6">
            <h2 className="font-display text-xl font-semibold">NyumbaSearch Plus</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Early access, scam alerts, unlimited saved searches.
            </p>
            <p className="mt-3 text-2xl font-display text-primary">
              {formatKes(PLUS_PLAN.monthlyKes)}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
            <p className="text-sm text-muted-foreground">
              or {formatKes(PLUS_PLAN.quarterlyKes)} for 3 months
            </p>
            <Link
              to="/tenant/checkout"
              search={{ plan: "plus" }}
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Get Plus
            </Link>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-display text-xl font-semibold">Market reports</h2>
            <ul className="mt-4 space-y-3">
              {REPORT_CATALOG.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 text-sm">
                  <span>{r.name}</span>
                  <Link
                    to="/landlord/checkout"
                    search={{ product: "report", reportType: r.id }}
                    className="shrink-0 font-semibold text-primary"
                  >
                    {formatKes(r.priceKes)} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">FAQ</h2>
          <div className="mt-6 space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="rounded-2xl border bg-card px-5 py-4">
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
