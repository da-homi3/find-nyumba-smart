/// <reference types="google.maps" />
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProperties, formatKes, prettyType, type Property } from "@/lib/properties";
import { MapPin, Navigation, Layers, Flame, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import markerClustererPkg from "@googlemaps/markerclusterer";
const { MarkerClusterer, SuperClusterAlgorithm } = markerClustererPkg;
type MarkerClustererType = InstanceType<typeof MarkerClusterer>;

export const Route = createFileRoute("/tenant/map")({
  head: () => ({ meta: [{ title: "Map — NyumbaSearch" }] }),
  component: TenantMap,
});

const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };
const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

// Stylish dark-emerald Google Maps style aligned with the Emerald Prestige palette
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0e1a14" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a8c84" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e1a14" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c9a84c" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#16261f" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5f7a6f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1f3a2e" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#c9a84c" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#06120d" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a6b58" }] },
];

let loaderPromise: Promise<typeof google> | null = null;
function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const cbName = "__nyumbaInitMap";
    (window as any)[cbName] = () => resolve((window as any).google);
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY ?? "",
      libraries: "visualization,marker",
      loading: "async",
      callback: cbName,
      ...(TRACKING_ID ? { channel: TRACKING_ID } : {}),
    });
    s.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

function priceTagSvg(label: string, active: boolean) {
  const bg = active ? "#c9a84c" : "#0d4f3c";
  const fg = active ? "#1a1a1a" : "#ffffff";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='86' height='38' viewBox='0 0 86 38'>
    <defs><filter id='s' x='-20%' y='-20%' width='140%' height='160%'>
      <feDropShadow dx='0' dy='2' stdDeviation='2' flood-color='#000' flood-opacity='0.35'/>
    </filter></defs>
    <g filter='url(#s)'>
      <rect x='1' y='1' rx='14' ry='14' width='84' height='28' fill='${bg}' stroke='#fff' stroke-width='1.5'/>
      <path d='M40 29 L43 36 L46 29 Z' fill='${bg}' stroke='#fff' stroke-width='1.5'/>
    </g>
    <text x='43' y='19' font-family='DM Sans, system-ui, sans-serif' font-size='12' font-weight='700' text-anchor='middle' fill='${fg}'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function compactKes(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${Math.round(n / 1_000)}K`;
  return `KES ${n}`;
}

function TenantMap() {
  const { data: properties = [] } = useQuery({ queryKey: ["properties"], queryFn: fetchProperties });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);
  const heatmap = useRef<any>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [query, setQuery] = useState("");

  // Init map
  useEffect(() => {
    if (!BROWSER_KEY) {
      setError("Google Maps key missing. Connect Google Maps Platform.");
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current) return;
        mapInstance.current = new g.maps.Map(mapRef.current, {
          center: NAIROBI_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          backgroundColor: "#0e1a14",
          styles: MAP_STYLE,
          gestureHandling: "greedy",
        });
        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // Render markers + clusters + heatmap whenever data or visibility changes
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const g = (window as any).google as typeof google;
    const map = mapInstance.current;

    // Clear existing
    clusterer.current?.clearMarkers();
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];

    const filtered = properties.filter((p) => {
      if (!p.latitude || !p.longitude) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        p.neighborhood.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        prettyType(p.property_type).toLowerCase().includes(q)
      );
    });

    const newMarkers = filtered.map((p) => {
      const marker = new g.maps.Marker({
        position: { lat: p.latitude!, lng: p.longitude! },
        icon: {
          url: priceTagSvg(compactKes(p.rent_kes).replace("KES ", ""), false),
          scaledSize: new g.maps.Size(86, 38),
          anchor: new g.maps.Point(43, 36),
        },
        title: p.title,
      });
      marker.addListener("click", () => {
        setSelected(p);
        map.panTo({ lat: p.latitude!, lng: p.longitude! });
      });
      (marker as any).__property = p;
      return marker;
    });
    markers.current = newMarkers;

    clusterer.current = new MarkerClusterer({
      map,
      markers: newMarkers,
      algorithm: new SuperClusterAlgorithm({ radius: 70, maxZoom: 15 }),
      renderer: {
        render: ({ count, position }) => {
          const size = Math.min(72, 40 + Math.log2(count) * 8);
          const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
            <circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 4}' fill='#c9a84c' fill-opacity='0.22'/>
            <circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 10}' fill='#0d4f3c' stroke='#c9a84c' stroke-width='2'/>
            <text x='50%' y='52%' text-anchor='middle' dominant-baseline='middle' font-family='Space Grotesk, system-ui, sans-serif' font-weight='700' font-size='${size / 3.2}' fill='#f5f0e0'>${count}</text>
          </svg>`;
          return new g.maps.Marker({
            position,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
              scaledSize: new g.maps.Size(size, size),
              anchor: new g.maps.Point(size / 2, size / 2),
            },
            zIndex: 999 + count,
          });
        },
      },
    });

    // Heatmap weighted by rent (so premium pockets glow brighter)
    heatmap.current?.setMap(null);
    if (g.maps.visualization && filtered.length) {
      const maxRent = Math.max(...filtered.map((p) => p.rent_kes));
      heatmap.current = new (g.maps.visualization as any).HeatmapLayer({
        data: filtered.map((p) => ({
          location: new g.maps.LatLng(p.latitude!, p.longitude!),
          weight: 0.4 + (p.rent_kes / maxRent) * 1.6,
        })),
        radius: 48,
        opacity: 0.7,
        gradient: [
          "rgba(0,0,0,0)",
          "rgba(13,79,60,0.55)",
          "rgba(34,139,98,0.7)",
          "rgba(201,168,76,0.85)",
          "rgba(232,184,74,0.95)",
          "rgba(255,107,53,1)",
        ],
      });
      heatmap.current.setMap(showHeat ? map : null);
    }
  }, [ready, properties, query, showHeat]);

  // Toggle heatmap visibility without rebuilding
  useEffect(() => {
    if (!heatmap.current || !mapInstance.current) return;
    heatmap.current.setMap(showHeat ? mapInstance.current : null);
  }, [showHeat]);

  // Highlight selected marker
  useEffect(() => {
    const g = (window as any).google as typeof google | undefined;
    if (!g) return;
    markers.current.forEach((m) => {
      const p: Property = (m as any).__property;
      const isActive = selected?.id === p.id;
      m.setIcon({
        url: priceTagSvg(compactKes(p.rent_kes).replace("KES ", ""), isActive),
        scaledSize: new g.maps.Size(86, 38),
        anchor: new g.maps.Point(43, 36),
      });
      m.setZIndex(isActive ? 9999 : undefined);
    });
  }, [selected]);

  const recenter = () => {
    mapInstance.current?.panTo(NAIROBI_CENTER);
    mapInstance.current?.setZoom(12);
  };

  return (
    <div className="relative h-[calc(100vh-5.5rem)] overflow-hidden bg-secondary">
      <div ref={mapRef} className="absolute inset-0" />

      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center bg-secondary/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm shadow-card">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Loading Nairobi map…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-4 top-4 rounded-2xl border bg-card p-4 text-sm shadow-card">
          <p className="font-semibold text-destructive">Map unavailable</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      )}

      {/* Top search bar */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-background/95 p-2 shadow-elegant backdrop-blur">
          <MapPin className="ml-2 h-4 w-4 text-primary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Kilimani, Westlands, bedsitter…"
            className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={recenter}
            className="rounded-xl bg-foreground p-2 text-background transition hover:opacity-90"
            aria-label="Recenter on Nairobi"
          >
            <Navigation className="h-4 w-4" />
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 self-start">
          <button
            onClick={() => setShowHeat((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-card backdrop-blur transition ${
              showHeat ? "bg-gradient-gold text-gold-foreground" : "bg-background/90 text-foreground"
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> Heatmap {showHeat ? "on" : "off"}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-card backdrop-blur">
            <Layers className="h-3.5 w-3.5" /> {markers.current.length} listings
          </span>
        </div>
      </div>

      {/* Bottom property sheet */}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10">
        {selected ? (
          <div className="pointer-events-auto relative flex gap-3 rounded-2xl border bg-card p-3 shadow-elegant">
            <button
              onClick={() => setSelected(null)}
              className="absolute right-2 top-2 rounded-full bg-secondary p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <img
              src={selected.images[0]}
              alt={selected.title}
              className="h-20 w-24 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1 pr-6">
              <h3 className="line-clamp-1 font-display font-semibold">{selected.title}</h3>
              <p className="text-xs text-muted-foreground">
                {prettyType(selected.property_type)} · {selected.neighborhood}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-primary">
                  {formatKes(selected.rent_kes)}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </p>
                <Link
                  to="/tenant/property/$id"
                  params={{ id: selected.id }}
                  className="rounded-full bg-gradient-gold px-3 py-1 text-[11px] font-semibold text-gold-foreground"
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto rounded-2xl bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground shadow-card backdrop-blur">
            Tap a pin or cluster · pinch to zoom · heatmap shows price intensity
          </div>
        )}
      </div>
    </div>
  );
}
