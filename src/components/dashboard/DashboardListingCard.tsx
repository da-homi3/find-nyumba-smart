import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { BarChart3, Pencil, Zap } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { formatKes, type Property } from "@/lib/properties";
import { getListingStatusConfig } from "@/lib/design/status";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/design/motion";
import { listingPlaceholderUrl } from "@/lib/property-images";

type PortalKind = "landlord" | "agency" | "manager";

const PORTAL_PATHS: Record<PortalKind, { edit: string; boost: string | null; analytics: string }> =
  {
    landlord: {
      edit: "/landlord/properties/$id/edit",
      boost: "/landlord/boost",
      analytics: "/landlord/analytics",
    },
    agency: {
      edit: "/agency/properties/$id/edit",
      boost: null,
      analytics: "/agency/analytics",
    },
    manager: {
      edit: "/manager/properties/$id/edit",
      boost: null,
      analytics: "/manager/analytics",
    },
  };

type Props = Readonly<{
  listing: Property;
  portal?: PortalKind;
  leadCount?: number;
  className?: string;
}>;

function AnimatedCounter({ value, label }: Readonly<{ value: number; label: string }>) {
  const reduceMotion = useReducedMotion();
  const spring = useSpring(reduceMotion ? value : 0, { stiffness: 100, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <motion.span>{display}</motion.span>
      {label}
    </span>
  );
}

export function DashboardListingCard({
  listing,
  portal = "landlord",
  leadCount = 0,
  className = "",
}: Props) {
  const config = getListingStatusConfig(listing);
  const reduceMotion = useReducedMotion();
  const paths = PORTAL_PATHS[portal];
  const thumb = listing.images[0] ?? listingPlaceholderUrl(listing.id);
  const isBoosted =
    !!listing.boost_package ||
    (listing.featured_until && new Date(listing.featured_until) > new Date());

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE }}
      className={`dash-listing-card group flex gap-4 rounded-2xl border bg-card p-4 shadow-soft ${className}`.trim()}
      style={{ borderLeft: `3px solid ${config.color}` }}
    >
      <div className="dash-listing-thumb relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary">
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {isBoosted ? (
          <span className="dash-boost-flag absolute left-1 top-1 rounded-md bg-gold px-1.5 py-0.5 text-[9px] font-bold text-gold-foreground">
            Boosted
          </span>
        ) : null}
      </div>

      <div className="dash-listing-info min-w-0 flex-1">
        <div className="dash-listing-header flex flex-wrap items-start justify-between gap-2">
          <h4 className="truncate font-semibold leading-tight">{listing.title}</h4>
          <StatusPill config={config} />
        </div>
        <p className="dash-listing-meta mt-1 text-sm text-muted-foreground">
          {listing.neighborhood} · {formatKes(listing.rent_kes)}/mo
        </p>
        <div className="dash-listing-stats mt-2 flex gap-4">
          <AnimatedCounter value={listing.views} label="views" />
          <AnimatedCounter value={leadCount} label="leads" />
        </div>
      </div>

      <div className="dash-listing-actions flex shrink-0 items-center gap-1 self-center">
        <Link
          to={paths.edit}
          params={{ id: listing.id }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Edit listing"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <Link
          to={paths.analytics}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="View analytics"
        >
          <BarChart3 className="h-4 w-4" />
        </Link>
        {listing.is_active && paths.boost ? (
          <Link
            to={paths.boost}
            search={{ propertyId: listing.id }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-gold transition-colors hover:bg-gold/10"
            aria-label="Boost listing"
          >
            <Zap className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </motion.div>
  );
}
