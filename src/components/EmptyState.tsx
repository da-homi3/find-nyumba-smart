import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, Heart, MessageCircle, Search, Users, type LucideIcon } from "lucide-react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/design/motion";

export const EMPTY_STATE_CONFIG = {
  no_listings: {
    title: "No listings yet",
    subtitle: "Add your first property and start receiving inquiries within days.",
    cta: "Add your first listing",
    href: "/landlord/properties/new",
    icon: Building2,
  },
  no_leads: {
    title: "No inquiries yet",
    subtitle: "Once a tenant unlocks your contact, you will see it here instantly.",
    cta: "Boost a listing for more visibility",
    href: "/landlord/boost",
    icon: Users,
  },
  no_search_results: {
    title: "No homes match yet",
    subtitle: "Try widening your budget or checking a nearby neighbourhood.",
    cta: "Clear filters",
    icon: Search,
  },
  no_messages: {
    title: "No conversations yet",
    subtitle: "Messages with landlords and tenants will appear here.",
    cta: null,
    icon: MessageCircle,
  },
  no_saved: {
    title: "No saved homes yet",
    subtitle: "Tap the heart on any listing to save it here for later.",
    cta: "Browse homes",
    href: "/tenant",
    icon: Heart,
  },
} as const;

export type EmptyStateType = keyof typeof EMPTY_STATE_CONFIG;

type Props = Readonly<{
  type: EmptyStateType;
  href?: string;
  cta?: string;
  onAction?: () => void;
  className?: string;
}>;

const ctaClassName =
  "empty-state-cta mt-5 inline-flex items-center gap-1 rounded-xl bg-gradient-emerald px-5 py-2.5 text-sm font-semibold text-primary-foreground";

function EmptyStateCta({
  label,
  href,
  onAction,
}: Readonly<{ label: string; href?: string; onAction?: () => void }>) {
  if (onAction) {
    return (
      <button type="button" onClick={onAction} className={ctaClassName}>
        {label} →
      </button>
    );
  }
  if (href) {
    return (
      <Link to={href} className={ctaClassName}>
        {label} →
      </Link>
    );
  }
  return null;
}

export function EmptyState({ type, href, cta, onAction, className = "" }: Props) {
  const config = EMPTY_STATE_CONFIG[type];
  const Icon = config.icon as LucideIcon;
  const reduceMotion = useReducedMotion();
  const linkHref = href ?? ("href" in config ? config.href : undefined);
  const ctaLabel = cta ?? config.cta;
  const showCta = Boolean(ctaLabel && (onAction || linkHref));

  return (
    <motion.div
      className={`empty-state rounded-2xl border-2 border-dashed bg-card p-10 text-center ${className}`.trim()}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: MOTION_DURATION.medium, ease: MOTION_EASE }}
    >
      <motion.div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="h-7 w-7" aria-hidden />
      </motion.div>
      <h3 className="mt-4 font-display text-lg font-semibold">{config.title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{config.subtitle}</p>
      {showCta && ctaLabel ? (
        <EmptyStateCta label={ctaLabel} href={linkHref} onAction={onAction} />
      ) : null}
    </motion.div>
  );
}
