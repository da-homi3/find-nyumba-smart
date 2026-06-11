import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "KES 0",
    period: "/mo",
    desc: "Get started with one verified listing.",
    features: ["1 listing", "Basic analytics", "Manual verification"],
    cta: "Start free",
    ctaTo: "/landlord",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Landlord Pro",
    price: "KES 999",
    period: "/mo",
    desc: "For active landlords with multiple units.",
    features: [
      "Up to 10 listings",
      "Full analytics",
      "Priority support",
      "Featured listing slot",
    ],
    cta: "Upgrade to Pro",
    ctaTo: "/landlord/dashboard/plan",
    highlighted: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: "KES 3,999",
    period: "/mo",
    desc: "Unlimited scale for property managers.",
    features: [
      "Unlimited listings",
      "Multi-user access",
      "API access",
      "Dedicated account manager",
    ],
    cta: "Contact sales",
    ctaTo: "/contact",
    highlighted: false,
  },
] as const;

export function PlanCards({ showCta = true }: { showCta?: boolean }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`rounded-2xl border p-6 shadow-soft ${
            plan.highlighted ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-card"
          }`}
        >
          <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
          <div className="mt-4 font-display text-3xl font-semibold text-primary">
            {plan.price}
            <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {showCta && (
            <Link
              to={plan.ctaTo}
              className={`mt-6 block rounded-xl py-3 text-center text-sm font-semibold ${
                plan.highlighted
                  ? "bg-primary text-primary-foreground hover:opacity-95"
                  : "border hover:bg-secondary"
              }`}
            >
              {plan.cta}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
