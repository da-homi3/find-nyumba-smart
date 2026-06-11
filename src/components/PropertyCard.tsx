import { Link } from "@tanstack/react-router";
import { BedDouble, Bath, MapPin, Flame, Heart, Droplets, Shield, Wifi, Car } from "lucide-react";
import { formatKes, prettyType, type Property } from "@/lib/properties";
import { VerificationBadge } from "@/components/VerificationBadge";
import { formatVerifiedAgo, getListingIntel, verificationLevel } from "@/lib/listing-intel";

type Props = {
  p: Property;
  saved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  showSave?: boolean;
};

function intelColor(label: string) {
  if (label === "Excellent" || label === "Good") return "text-emerald-600";
  if (label === "Moderate") return "text-amber-600";
  return "text-red-600";
}

export function PropertyCard({ p, saved, onToggleSave, showSave = true }: Props) {
  const score = p.authenticity_score ?? 70;
  const level = verificationLevel(p);
  const intel = getListingIntel(p);

  return (
    <article className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <Link to="/tenant/property/$id" params={{ id: p.id }} className="block h-full">
          {p.images[0] ? (
            <img
              src={p.images[0]}
              alt={p.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">No image</div>
          )}
        </Link>
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {level > 0 && <VerificationBadge level={level} />}
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            <Flame className="h-3 w-3 text-orange-400" aria-hidden /> {score}%
          </span>
        </div>
        {showSave && onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            aria-label={saved ? "Remove from saved" : "Save listing"}
            className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-background/95 shadow-soft backdrop-blur"
          >
            <Heart
              className={`h-4 w-4 ${saved ? "fill-destructive text-destructive" : "text-foreground"}`}
            />
          </button>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-gradient-gold px-3 py-1 text-xs font-semibold text-gold-foreground">
          {formatKes(p.rent_kes)}
          <span className="font-normal opacity-70"> / mo</span>
        </span>
        <span className="absolute bottom-3 right-3 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
          {prettyType(p.property_type)}
        </span>
      </div>

      <div className="p-4">
        <Link to="/tenant/property/$id" params={{ id: p.id }}>
          <h3 className="line-clamp-1 font-display text-base font-semibold group-hover:text-primary">
            {p.title}
          </h3>
        </Link>
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
          <Link
            to="/tenant/property/$id"
            params={{ id: p.id }}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-95"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
