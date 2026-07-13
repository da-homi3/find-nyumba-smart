import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { REVIEW_PRIORITY_CONFIG, resolveReviewPriority } from "@/lib/design/status";
import type { Property } from "@/lib/properties";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/design/motion";

type Props = Readonly<{
  listing: Property;
  children?: ReactNode;
  actions?: ReactNode;
}>;

export function ReviewQueueItem({ listing, children, actions }: Props) {
  const priority = resolveReviewPriority(listing);
  const config = REVIEW_PRIORITY_CONFIG[priority];
  const reduceMotion = useReducedMotion();
  const fraudFlags: string[] = [];
  const score = listing.authenticity_score ?? 70;
  if (score < 60) fraudFlags.push("Low authenticity score");
  if (!listing.is_verified) fraudFlags.push("Unverified listing");

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE }}
      className="review-queue-item rounded-2xl p-4 sm:p-5"
      style={{
        border: config.border,
        background: config.bg,
      }}
    >
      {config.label ? (
        <span
          className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/tenant/property/$id"
            params={{ id: listing.id }}
            className="font-semibold hover:underline"
          >
            {listing.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {listing.neighborhood} · Score {score}/100
          </p>
          {fraudFlags.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {fraudFlags.map((flag) => (
                <li key={flag}>• {flag}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </motion.div>
  );
}
