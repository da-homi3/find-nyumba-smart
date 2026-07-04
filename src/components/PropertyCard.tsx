import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { BedDouble, Bath, MapPin, Flame, Droplets, Shield, Wifi, Car } from "lucide-react";
import { formatKes, prettyType, type Property } from "@/lib/properties";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PropertyImage } from "@/components/PropertyImage";
import { formatVerifiedAgo, getListingIntel, verificationLevel } from "@/lib/listing-intel";
import { isListingEarlyAccess } from "@/lib/revenue/entitlements";
import { SaveButton } from "@/components/motion/SaveButton";
import { isTouchDevice } from "@/lib/motion/performance";

type Props = {
  readonly p: Property;
  readonly saved?: boolean;
  readonly onToggleSave?: (e: React.MouseEvent) => void;
  readonly showSave?: boolean;
  readonly plusMember?: boolean;
};

function intelColor(label: string) {
  if (label === "Excellent" || label === "Good") return "text-emerald-600";
  if (label === "Moderate") return "text-amber-600";
  return "text-red-600";
}

export function PropertyCard({
  p,
  saved,
  onToggleSave,
  showSave = true,
  plusMember = false,
}: Readonly<Props>) {
  const cardRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const touch = isTouchDevice();

  const score = p.authenticity_score ?? 70;
  const level = verificationLevel(p);
  const intel = getListingIntel(p);
  const isFeatured = p.featured_until && new Date(p.featured_until) > new Date();
  const earlyAccess = isListingEarlyAccess(p.created_at, plusMember);
  const coverImage = p.images[0];

  const handleMouseMove = (e: React.MouseEvent) => {
    if (touch) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * -20,
    });
  };

  return (
    <motion.article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePos({ x: 0, y: 0 });
      }}
      animate={{
        rotateY: isHovered && !touch ? mousePos.x * 0.5 : 0,
        rotateX: isHovered && !touch ? mousePos.y * 0.5 : 0,
        y: isHovered ? -8 : 0,
        scale: isHovered ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{ transformStyle: "preserve-3d", willChange: "transform", transformPerspective: 1000 }}
      className={`group relative overflow-hidden rounded-[20px] border border-white/6 bg-(--surface-1) shadow-[0_4px_24px_rgba(0,0,0,0.24)] ${
        isFeatured ? "ring-2 ring-gold/40" : ""
      } ${isHovered ? "shadow-[0_32px_80px_rgba(0,0,0,0.25),0_0_0_1px_rgba(30,184,138,0.2)]" : ""}`}
    >
      <Link
        to="/tenant/property/$id"
        params={{ id: p.id }}
        className="absolute inset-0 z-0 rounded-[20px]"
        aria-label={`View ${p.title}`}
      />

      <div className="relative z-10 pointer-events-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <motion.div
            animate={{
              scale: isHovered ? 1.08 : 1,
              x: isHovered ? mousePos.x * 0.3 : 0,
              y: isHovered ? mousePos.y * 0.3 : 0,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
            className="h-[112%] w-[112%] -m-[6%]"
          >
            <PropertyImage
              src={coverImage}
              seed={p.id}
              alt={p.title}
              className="h-full w-full object-cover"
            />
          </motion.div>
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-50% to-[rgba(13,17,23,0.7)]"
            aria-hidden
          />
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {isFeatured && (
              <span className="inline-flex rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                Featured
              </span>
            )}
            {p.nyumba_verified_at && (
              <span className="inline-flex rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                NyumbaSearch Verified ✓
              </span>
            )}
            {level > 0 && <VerificationBadge level={level} variant="glass" />}
            {plusMember ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                <Flame className="h-3 w-3 text-orange-400" aria-hidden /> Scam risk {100 - score}%
              </span>
            ) : (
              <Link
                to="/tenant/checkout"
                search={{ plan: "plus" }}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur"
              >
                <Flame className="h-3 w-3 text-orange-400" aria-hidden /> Plus: scam score
              </Link>
            )}
            {earlyAccess && (
              <span className="inline-flex rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                Plus early access
              </span>
            )}
          </div>
          {showSave && onToggleSave && (
            <SaveButton saved={saved} onToggle={onToggleSave} className="absolute top-3 right-3" />
          )}
          <motion.span
            whileHover={{ scale: 1.05 }}
            className="listing-price-chip absolute bottom-3 left-3"
          >
            {formatKes(p.rent_kes)}
            <span>/ mo</span>
          </motion.span>
          <span className="absolute bottom-3 right-3 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
            {prettyType(p.property_type)}
          </span>
        </div>

        <div className="p-4">
          <h3 className="line-clamp-1 font-display text-base font-semibold group-hover:text-primary">
            {p.title}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span>
              {p.neighborhood} · {intel.subArea}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {formatVerifiedAgo(intel.verifiedDaysAgo)}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium">
            <span className={`inline-flex items-center gap-0.5 ${intelColor(intel.water)}`}>
              <Droplets className="h-3 w-3" aria-hidden /> Water: {intel.water}
            </span>
            <span className={`inline-flex items-center gap-0.5 ${intelColor(intel.security)}`}>
              <Shield className="h-3 w-3" aria-hidden /> Security: {intel.security}
            </span>
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Wifi className="h-3 w-3" aria-hidden />
              {intel.internet ? (intel.internetProviders[0] ?? "Yes") : "No fibre"}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" aria-hidden />
                {p.bedrooms} bd
              </span>
              <span className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" aria-hidden />
                {p.bathrooms} ba
              </span>
              {intel.parking && (
                <span className="flex items-center gap-1">
                  <Car className="h-3.5 w-3.5" aria-hidden />
                  Parking
                </span>
              )}
            </div>
            <motion.span
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="shrink-0 rounded-lg bg-gradient-emerald px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              View details
            </motion.span>
          </div>
        </div>
      </div>

      {isHovered && !touch && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: `radial-gradient(circle at ${50 + mousePos.x}% ${50 - mousePos.y}%, rgba(30,184,138,0.08), transparent 60%)`,
          }}
        />
      )}
    </motion.article>
  );
}
