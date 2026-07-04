import { motion } from "framer-motion";
import type { ReactNode } from "react";

function parsePercent(stat: string): number {
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(stat);
  if (m) return Math.min(100, Number.parseFloat(m[1]));
  const score = /(\d+(?:\.\d+)?)\s*\/\s*5/.exec(stat);
  if (score) return (Number.parseFloat(score[1]) / 5) * 100;
  return 72;
}

export function IntelligenceMetric({
  icon,
  title,
  stat,
  description,
  loading = false,
}: Readonly<{
  icon: ReactNode;
  title: string;
  stat: string;
  description: string;
  loading?: boolean;
}>) {
  const fill = parsePercent(stat);

  return (
    <motion.div
      className={`intel-metric-card rounded-2xl border border-white/8 bg-(--surface-1) p-6 shadow-soft ${loading ? "animate-pulse" : ""}`}
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <div className="intel-metric-icon grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h4 className="mt-4 font-display text-lg font-semibold">{title}</h4>
      <p className="intel-metric-desc mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="intel-metric-stat-bar mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="intel-metric-stat-fill h-full rounded-full bg-gradient-emerald"
          initial={{ width: 0 }}
          whileInView={{ width: `${fill}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      <span className="intel-metric-number mt-3 block text-sm font-semibold text-primary">{stat}</span>
    </motion.div>
  );
}
