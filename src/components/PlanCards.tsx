import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { PlanCardDef } from "@/lib/revenue/plans";
import { planPriceLabel } from "@/lib/revenue/plans";

type Props = {
  plans: PlanCardDef[];
  showCta?: boolean;
  columns?: 2 | 3;
};

export function PlanCards({ plans, showCta = true, columns = 3 }: Readonly<Props>) {
  const gridClass = columns === 2 ? "grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-3";

  return (
    <div className={gridClass}>
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`relative rounded-2xl border p-6 shadow-soft ${
            plan.highlighted ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-card"
          }`}
        >
          {plan.badge && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              {plan.badge}
            </span>
          )}
          <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
          <div className="mt-4 font-display text-3xl font-semibold text-primary">
            {planPriceLabel(plan)}
            <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {showCta &&
            (plan.ctaTo.includes("?") || plan.ctaTo.includes("#") ? (
              <a
                href={plan.ctaTo}
                className={`mt-6 block rounded-xl py-3 text-center text-sm font-semibold ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:opacity-95"
                    : "border hover:bg-secondary"
                }`}
              >
                {plan.cta}
              </a>
            ) : (
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
            ))}
        </div>
      ))}
    </div>
  );
}
