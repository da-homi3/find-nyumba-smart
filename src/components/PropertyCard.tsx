import { Link } from "@tanstack/react-router";
import { BedDouble, Bath, MapPin, ShieldCheck } from "lucide-react";
import { formatKes, prettyType, type Property } from "@/lib/properties";

export function PropertyCard({ p }: { p: Property }) {
  return (
    <Link
      to="/tenant/property/$id"
      params={{ id: p.id }}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:shadow-card hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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
        {p.is_verified && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-semibold text-primary backdrop-blur">
            <ShieldCheck className="h-3 w-3" /> Verified
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-gradient-gold px-3 py-1 text-xs font-semibold text-gold-foreground">
          {formatKes(p.rent_kes)}
          <span className="font-normal opacity-70">/mo</span>
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="line-clamp-1 font-display text-base font-semibold">{p.title}</h3>
          <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            {prettyType(p.property_type)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {p.neighborhood}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {p.bedrooms} bd
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {p.bathrooms} ba
          </span>
          {p.area_sqm && <span>{p.area_sqm} m²</span>}
        </div>
      </div>
    </Link>
  );
}
