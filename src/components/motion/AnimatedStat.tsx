import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  decimals?: number;
};

export function AnimatedStat({
  value,
  suffix = "",
  prefix = "",
  label,
  decimals = 0,
}: Readonly<Props>) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => {
    const n = decimals > 0 ? v.toFixed(decimals) : Math.floor(v).toLocaleString("en-KE");
    return `${prefix}${n}${suffix}`;
  });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, value, { duration: 2, ease: "easeOut" });
    return controls.stop;
  }, [inView, value, count]);

  return (
    <div ref={ref} className="text-center sm:text-left">
      <div className="font-display text-2xl font-extrabold text-(--color-mint,#1eb88a) sm:text-3xl tabular-nums">
        <motion.span>{rounded}</motion.span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
