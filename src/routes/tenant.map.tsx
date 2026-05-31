import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProperties, formatKes } from "@/lib/properties";
import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/tenant/map")({
  head: () => ({ meta: [{ title: "Map — NyumbaSearch" }] }),
  component: TenantMap,
});

// Nairobi bounds (rough) for mapping lat/lng → SVG coords
const BOUNDS = { minLat: -1.36, maxLat: -1.20, minLng: 36.68, maxLng: 36.92 };

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x, y };
}

function TenantMap() {
  const { data: properties = [] } = useQuery({ queryKey: ["properties"], queryFn: fetchProperties });
  const [selected, setSelected] = useState<string | null>(null);
  const sel = properties.find((p) => p.id === selected);

  return (
    <div className="relative h-[calc(100vh-5.5rem)] overflow-hidden bg-secondary">
      {/* Faux stylised map */}
      <div className="absolute inset-0">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <pattern id="grid" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M 6 0 L 0 0 0 6" fill="none" stroke="oklch(0.36 0.09 160 / 0.07)" strokeWidth="0.2" />
            </pattern>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.78 0.13 80 / 0.35)" />
              <stop offset="100%" stopColor="oklch(0.78 0.13 80 / 0)" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="oklch(0.95 0.02 100)" />
          <rect width="100" height="100" fill="url(#grid)" />
          {/* fake roads */}
          <path d="M0,55 Q30,45 55,52 T100,50" stroke="oklch(0.85 0.02 100)" strokeWidth="1.2" fill="none" />
          <path d="M40,0 Q45,40 50,60 T55,100" stroke="oklch(0.85 0.02 100)" strokeWidth="1" fill="none" />
          <path d="M10,80 Q40,70 70,80 T100,75" stroke="oklch(0.85 0.02 100)" strokeWidth="0.8" fill="none" />
          {/* heat glow */}
          <circle cx="50" cy="55" r="22" fill="url(#glow)" />
          {/* pins */}
          {properties.filter((p) => p.latitude && p.longitude).map((p) => {
            const { x, y } = project(p.latitude!, p.longitude!);
            const active = selected === p.id;
            return (
              <g key={p.id} transform={`translate(${x} ${y})`} onClick={() => setSelected(p.id)} className="cursor-pointer">
                <circle r={active ? 1.8 : 1.2} fill={active ? "oklch(0.78 0.13 80)" : "oklch(0.36 0.09 160)"} stroke="white" strokeWidth="0.3" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Top bar */}
      <div className="absolute top-4 inset-x-4 flex items-center gap-2 rounded-2xl bg-background/95 p-2 shadow-elegant backdrop-blur">
        <MapPin className="ml-2 h-4 w-4 text-primary" />
        <input
          placeholder="Search Nairobi neighborhoods…"
          className="flex-1 bg-transparent py-1.5 text-sm outline-none"
        />
        <button className="rounded-xl bg-foreground p-2 text-background">
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom property sheet */}
      <div className="absolute bottom-4 inset-x-4">
        {sel ? (
          <a href={`/tenant/property/${sel.id}`} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-elegant">
            <img src={sel.images[0]} alt={sel.title} className="h-20 w-24 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-1 font-display font-semibold">{sel.title}</h3>
              <p className="text-xs text-muted-foreground">{sel.neighborhood}</p>
              <p className="mt-1 text-sm font-semibold text-primary">{formatKes(sel.rent_kes)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
            </div>
          </a>
        ) : (
          <div className="rounded-2xl bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground shadow-card backdrop-blur">
            Tap a pin to preview a property · {properties.length} vacancies on map
          </div>
        )}
      </div>
    </div>
  );
}
