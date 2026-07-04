import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { PlanCardDef } from "@/lib/revenue/plans";
import { planPriceLabel } from "@/lib/revenue/plans";

type Props = {
  plans: PlanCardDef[];
  showCta?: boolean;
  columns?: 2 | 3;
};

const ctaMotion = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
} as const;

function parseCheckoutTarget(
  ctaTo: string,
): { path: "/landlord/checkout" | "/manager/checkout" | "/agency/checkout"; plan: string } | null {
  try {
    const url = new URL(ctaTo, "https://nyumba.local");
    const plan = url.searchParams.get("plan");
    if (!plan) return null;
    if (url.pathname === "/landlord/checkout") return { path: "/landlord/checkout", plan };
    if (url.pathname === "/manager/checkout") return { path: "/manager/checkout", plan };
    if (url.pathname === "/agency/checkout") return { path: "/agency/checkout", plan };
    return null;
  } catch {
    return null;
  }
}

function PlanCta({ plan, className }: Readonly<{ plan: PlanCardDef; className: string }>) {
  const label = `${plan.cta} →`;
  const checkout = parseCheckoutTarget(plan.ctaTo);

  if (checkout) {
    return (
      <motion.div {...ctaMotion}>
        <Link to={checkout.path} search={{ plan: checkout.plan }} className={className}>
          {label}
        </Link>
      </motion.div>
    );
  }

  if (plan.ctaTo.includes("?") || plan.ctaTo.includes("#")) {
    return (
      <motion.a href={plan.ctaTo} {...ctaMotion} className={className}>
        {label}
      </motion.a>
    );
  }

  return (
    <motion.div {...ctaMotion}>
      <Link to={plan.ctaTo} className={className}>
        {label}
      </Link>
    </motion.div>
  );
}

function PricingCard3D({ plan, showCta }: Readonly<{ plan: PlanCardDef; showCta: boolean }>) {
  const isPopular = plan.highlighted;

  const ctaClass = isPopular
    ? "bg-gradient-emerald text-white shadow-green"
    : "border border-white/15 bg-white/5 hover:bg-white/10";

  return (
    <motion.div
      animate={{ y: isPopular ? -12 : 0, scale: isPopular ? 1.03 : 1 }}
      whileHover={{ y: isPopular ? -14 : -8, scale: isPopular ? 1.04 : 1.02, rotateY: 2 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`relative rounded-3xl p-6 transform-3d ${
        isPopular
          ? "border border-[#1eb88a] bg-linear-to-br from-[rgba(10,92,71,0.9)] to-[rgba(30,184,138,0.15)] shadow-[0_24px_80px_rgba(30,184,138,0.3)]"
          : "border border-white/10 bg-glass-bg shadow-soft backdrop-blur-xl"
      }`}
    >
      {plan.badge ? (
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-emerald px-4 py-1 text-xs font-bold text-white shadow-green"
        >
          ✦ {plan.badge}
        </motion.span>
      ) : null}

      <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>

      <div className="mt-4 flex items-baseline gap-1 font-display">
        <motion.span
          whileHover={{ scale: 1.05 }}
          className={`text-4xl font-extrabold ${isPopular ? "text-[#1eb88a]" : "text-foreground"}`}
        >
          {planPriceLabel(plan)}
        </motion.span>
        <span className="text-sm text-muted-foreground">{plan.period}</span>
      </div>

      <ul className="mt-6 space-y-3 text-sm">
        {plan.features.map((feature, index) => (
          <motion.li
            key={`${plan.id}-${index}`}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-2"
          >
            <motion.span
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 + 0.2, type: "spring" }}
              className="mt-0.5 font-bold text-[#1eb88a]"
            >
              ✓
            </motion.span>
            {feature}
          </motion.li>
        ))}
      </ul>

      {showCta ? (
        <PlanCta
          plan={plan}
          className={`mt-6 block rounded-xl py-3 text-center text-sm font-semibold ${ctaClass}`}
        />
      ) : null}
    </motion.div>
  );
}

export function PlanCards({ plans, showCta = true, columns = 3 }: Readonly<Props>) {
  const gridClass =
    columns === 2
      ? "grid gap-6 [perspective:1200px] md:grid-cols-2"
      : "grid gap-6 [perspective:1200px] md:grid-cols-3";

  return (
    <div className={gridClass}>
      {plans.map((plan) => (
        <PricingCard3D key={plan.id} plan={plan} showCta={showCta} />
      ))}
    </div>
  );
}
