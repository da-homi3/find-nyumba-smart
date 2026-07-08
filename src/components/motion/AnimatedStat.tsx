import { animate, motion, useInView } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  decimals?: number;
  ready?: boolean;
  suffixIcon?: LucideIcon;
};

function formatStatValue(v: number, decimals: number, prefix: string, suffix: string): string {
  const n = decimals > 0 ? v.toFixed(decimals) : Math.floor(v).toLocaleString("en-KE");
  return `${prefix}${n}${suffix}`;
}

export function AnimatedStat({
  value,
  suffix = "",
  prefix = "",
  label,
  decimals = 0,
  ready = true,
  suffixIcon: SuffixIcon,
}: Readonly<Props>) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState("—");

  useEffect(() => {
    if (!ready || !inView) return;
    const controls = animate(0, value, {
      duration: 2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(formatStatValue(v, decimals, prefix, suffix)),
    });
    return () => controls.stop();
  }, [inView, value, decimals, prefix, suffix, ready]);

  return (
    <div ref={ref} className="text-center sm:text-left">
      <div className="inline-flex items-baseline justify-center gap-1 font-display text-2xl font-extrabold text-(--color-mint,#1eb88a) sm:justify-start sm:text-3xl tabular-nums">
        <motion.span>{ready ? display : "—"}</motion.span>
        {SuffixIcon ? (
          <SuffixIcon
            className="h-5 w-5 fill-(--color-gold,#f6ad55) text-(--color-gold,#f6ad55)"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
