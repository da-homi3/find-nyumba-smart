import { Link } from "@tanstack/react-router";
import { memo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BedDouble,
  Bath,
  MapPin,
  Flame,
  Droplets,
  Shield,
  Wifi,
  Car,
  BadgeCheck,
} from "lucide-react";
import { prettyType, type Property } from "@/lib/properties";
import { formatListingPrice } from "@/lib/commercial-ranges";
import { listingPricingNote } from "@/lib/property-types";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PropertyImage } from "@/components/PropertyImage";
import { formatVerifiedAgo, getListingIntel, verificationLevel } from "@/lib/listing-intel";
import { isListingEarlyAccess } from "@/lib/revenue/entitlements";
import { SaveButton } from "@/components/motion/SaveButton";
import { isTouchDevice } from "@/lib/motion/performance";
import { ListingsPreviewOverlay } from "@/components/ListingsPreviewOverlay";

type Props = {
  readonly p: Property;
  readonly saved?: boolean;
  readonly onToggleSave?: (e: React.MouseEvent) => void;
  readonly showSave?: boolean;
  readonly plusMember?: boolean;
  readonly preview?: boolean;
};

function intelColor(label: string) {
  if (label === "Excellent" || label === "Good") return "text-emerald-600";
  if (label === "Moderate") return "text-amber-600";
  return "text-red-600";
}

function internetLabel(intel: ReturnType<typeof getListingIntel>) {
  if (!intel.internet) return "No fibre";
  return intel.internetProviders[0] ?? "Yes";
}

function leaseNote(property: Property) {
  return listingPricingNote({
    property_type: property.property_type,
    pricing_mode: property.pricing_mode,
    price_period: property.price_period,
    minimum_rent_period_months: property.minimum_rent_period_months,
  });
}

function PropertyScamRiskBadge({
  plusMember,
  score,
}: Readonly<{ plusMember: boolean; score: number }>) {
  if (plusMember) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
        <Flame className="h-3 w-3 text-orange-400" aria-hidden /> Scam risk {100 - score}%
      </span>
    );
  }

  return (
    <Link
      to="/tenant/checkout"
      search={{ plan: "plus" }}
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur"
    >
      <Flame className="h-3 w-3 text-orange-400" aria-hidden /> Plus: scam score
    </Link>
  );
}

function PropertyCardBadges({
  property,
  level,
  score,
  plusMember,
  earlyAccess,
}: Readonly<{
  property: Property;
  level: number;
  score: number;
  plusMember: boolean;
  earlyAccess: boolean;
}>) {
  const isFeatured = property.featured_until && new Date(property.featured_until) > new Date();

  return (
    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
      {isFeatured ? (
        <span className="inline-flex rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
          Featured
        </span>
      ) : null}
      {property.nyumba_verified_at ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
          <BadgeCheck className="h-3 w-3" aria-hidden />
          NyumbaSearch Verified
        </span>
      ) : null}
      {level > 0 ? <VerificationBadge level={level} variant="glass" /> : null}
      <PropertyScamRiskBadge plusMember={plusMember} score={score} />
      {earlyAccess ? (
        <span className="inline-flex rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
          Plus early access
        </span>
      ) : null}
    </div>
  );
}

function PropertyCardImage({
  property,
  coverImage,
  level,
  score,
  plusMember,
  earlyAccess,
  saved,
  showSave,
  onToggleSave,
  isHovered,
  lightMotion,
  mousePos,
}: Readonly<{
  property: Property;
  coverImage: string | undefined;
  level: number;
  score: number;
  plusMember: boolean;
  earlyAccess: boolean;
  saved?: boolean;
  showSave: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  isHovered: boolean;
  lightMotion: boolean;
  mousePos: { x: number; y: number };
}>) {
  const interactive = isHovered && !lightMotion;

  return (
    <div className="relative aspect-4/3 overflow-hidden bg-muted">
      <motion.div
        animate={{
          scale: interactive ? 1.08 : 1,
          x: interactive ? mousePos.x * 0.3 : 0,
          y: interactive ? mousePos.y * 0.3 : 0,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        className="h-[112%] w-[112%] m-[-6%]"
      >
        <PropertyImage
          src={coverImage}
          seed={property.id}
          alt={property.title}
          className="h-full w-full object-cover"
        />
      </motion.div>
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-50% to-[rgba(13,17,23,0.7)]"
        aria-hidden
      />
      <PropertyCardBadges
        property={property}
        level={level}
        score={score}
        plusMember={plusMember}
        earlyAccess={earlyAccess}
      />
      {showSave && onToggleSave ? (
        <SaveButton saved={saved} onToggle={onToggleSave} className="absolute top-3 right-3" />
      ) : null}
      <motion.span
        whileHover={{ scale: 1.05 }}
        className="listing-price-chip absolute bottom-3 left-3"
      >
        {formatListingPrice(property)}
      </motion.span>
      <span className="absolute bottom-3 right-3 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
        {prettyType(property.property_type)}
      </span>
    </div>
  );
}

function PropertyCardDetails({
  property,
  intel,
  verifiedNote,
}: Readonly<{
  property: Property;
  intel: ReturnType<typeof getListingIntel>;
  verifiedNote: string;
}>) {
  return (
    <div className="p-4">
      <h3 className="line-clamp-1 font-display text-base font-semibold group-hover:text-primary">
        {property.title}
      </h3>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
        <span>
          {property.neighborhood} · {intel.subArea}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{verifiedNote}</p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium">
        <span className={`inline-flex items-center gap-0.5 ${intelColor(intel.water)}`}>
          <Droplets className="h-3 w-3" aria-hidden /> Water: {intel.water}
        </span>
        <span className={`inline-flex items-center gap-0.5 ${intelColor(intel.security)}`}>
          <Shield className="h-3 w-3" aria-hidden /> Security: {intel.security}
        </span>
        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
          <Wifi className="h-3 w-3" aria-hidden />
          {internetLabel(intel)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" aria-hidden />
            {property.bedrooms} bd
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" aria-hidden />
            {property.bathrooms} ba
          </span>
          {intel.parking ? (
            <span className="flex items-center gap-1">
              <Car className="h-3.5 w-3.5" aria-hidden />
              Parking
            </span>
          ) : null}
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
  );
}

function PropertyCardHoverGlow({
  isHovered,
  lightMotion,
  mousePos,
}: Readonly<{
  isHovered: boolean;
  lightMotion: boolean;
  mousePos: { x: number; y: number };
}>) {
  if (!isHovered || lightMotion) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-2xl"
      style={{
        background: `radial-gradient(circle at ${50 + mousePos.x}% ${50 - mousePos.y}%, rgba(30,184,138,0.08), transparent 60%)`,
      }}
    />
  );
}

export const PropertyCard = memo(function PropertyCard({
  p,
  saved,
  onToggleSave,
  showSave = true,
  plusMember = false,
  preview = false,
}: Readonly<Props>) {
  const cardRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const touch = isTouchDevice();
  const lightMotion = reduceMotion || touch;

  const score = p.authenticity_score ?? 70;
  const level = verificationLevel(p);
  const intel = getListingIntel(p);
  const isFeatured = p.featured_until && new Date(p.featured_until) > new Date();
  const earlyAccess = isListingEarlyAccess(p.created_at, plusMember);
  const coverImage = p.images[0];
  const verifiedNote = `${formatVerifiedAgo(intel.verifiedDaysAgo)}${leaseNote(p)}`;
  const interactive = isHovered && !lightMotion;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (lightMotion) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * -20,
    });
  };

  return (
    <ListingsPreviewOverlay active={preview} variant="card">
      <motion.article
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setMousePos({ x: 0, y: 0 });
        }}
        animate={{
          rotateY: interactive ? mousePos.x * 0.5 : 0,
          rotateX: interactive ? mousePos.y * 0.5 : 0,
          y: interactive ? -8 : 0,
          scale: interactive ? 1.02 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={{
          transformStyle: "preserve-3d",
          willChange: "transform",
          transformPerspective: 1000,
        }}
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
          <PropertyCardImage
            property={p}
            coverImage={coverImage}
            level={level}
            score={score}
            plusMember={plusMember}
            earlyAccess={earlyAccess}
            saved={saved}
            showSave={showSave}
            onToggleSave={onToggleSave}
            isHovered={isHovered}
            lightMotion={lightMotion}
            mousePos={mousePos}
          />
          <PropertyCardDetails property={p} intel={intel} verifiedNote={verifiedNote} />
        </div>

        <PropertyCardHoverGlow
          isHovered={isHovered}
          lightMotion={lightMotion}
          mousePos={mousePos}
        />
      </motion.article>
    </ListingsPreviewOverlay>
  );
});
