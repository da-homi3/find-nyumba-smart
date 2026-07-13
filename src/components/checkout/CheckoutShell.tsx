import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/design/motion";

type Props = Readonly<{
  title: string;
  subtitle?: string;
  priceLabel?: string;
  children: ReactNode;
  step?: number;
  totalSteps?: number;
  className?: string;
}>;

export function CheckoutShell({
  title,
  subtitle,
  priceLabel,
  children,
  step = 0,
  totalSteps = 1,
  className = "",
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`checkout-shell ${className}`.trim()}>
      <div className="checkout-shell-header">
        {totalSteps > 1 ? <CheckoutProgress current={step} total={totalSteps} /> : null}
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {subtitle ? (
          <p className="checkout-subtitle mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        {priceLabel ? (
          <motion.div
            className="checkout-price-tag mt-4 inline-block rounded-xl bg-primary/10 px-4 py-2 font-display text-xl font-semibold text-primary"
            initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE }}
          >
            {priceLabel}
          </motion.div>
        ) : null}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
          transition={{ duration: MOTION_DURATION.medium, ease: MOTION_EASE }}
          className="mt-6"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CheckoutProgress({ current, total }: Readonly<{ current: number; total: number }>) {
  const value = current + 1;
  const percent = Math.round((value / total) * 100);

  return (
    <div className="mb-5">
      <progress
        className="checkout-progress"
        value={value}
        max={total}
        aria-label={`Checkout step ${value} of ${total}`}
      />
      <p className="sr-only">{percent}% complete</p>
    </div>
  );
}
