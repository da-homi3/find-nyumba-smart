import { motion, useReducedMotion } from "framer-motion";
import type { ListingStatusConfig } from "@/lib/design/status";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/design/motion";

type Props = Readonly<{
  config: ListingStatusConfig;
  className?: string;
}>;

export function StatusPill({ config, className = "" }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE }}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${className}`.trim()}
      style={{
        background: `color-mix(in srgb, ${config.color} 9%, transparent)`,
        color: config.color,
        border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
      }}
    >
      <span aria-hidden>{config.icon}</span>
      {config.label}
    </motion.span>
  );
}
