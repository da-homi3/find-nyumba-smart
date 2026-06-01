/// <reference types="google.maps" />
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProperties, formatKes, prettyType, type Property } from "@/lib/properties";
import { MapPin, Navigation, Layers, Flame, X, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
// Dynamically imported in-browser to avoid SSR CJS interop issues
type MarkerClustererType = import("@googlemaps/markerclusterer").MarkerClusterer;
type MarkerClustererModule = typeof import("@googlemaps/markerclusterer") & {
  default?: typeof import("@googlemaps/markerclusterer");
};
type GoogleMapsWindow = Window &
  typeof globalThis & {
    google?: typeof google;
    gm_authFailure?: () => void;
    __nyumbaInitMap?: () => void;
  };
type PropertyMarker = google.maps.Marker & { __property?: Property };

const getGoogleMapsWindow = () => window as GoogleMapsWindow;

export const Route = createFileRoute("/tenant/map")({
  head: () => ({ meta: [{ title: "Map — NyumbaSearch" }] }),
  component: TenantMap,
});

const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };
const NAIROBI_BOUNDS = {
  minLat: -1.46,
  maxLat: -1.16,
  minLng: 36.62,
  maxLng: 37.08,
};
const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

// Stylish dark-emerald Google Maps style aligned with the Emerald Prestige palette
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0e1a14" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a8c84" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e1a14" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c9a84c" }],
  },
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
  const mapsWindow = getGoogleMapsWindow();
  if (mapsWindow.google?.maps) return Promise.resolve(mapsWindow.google);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const cbName = "__nyumbaInitMap";
    const previousAuthFailure = mapsWindow.gm_authFailure;
    mapsWindow.gm_authFailure = () => {
      previousAuthFailure?.();
      reject(new Error("Google Maps key is not authorized for this domain."));
    };
    mapsWindow[cbName] = () => {
      if (mapsWindow.google) resolve(mapsWindow.google);
      else reject(new Error("Google Maps failed to initialize"));
    };
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY ?? "",
      libraries: "marker",
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

function filterMappableProperties(properties: Property[], query: string) {
  const qq = query.trim().toLowerCase();
  return properties.filter((p) => {
    if (!p.latitude || !p.longitude) return false;
    if (!qq) return true;
    return (
      p.neighborhood.toLowerCase().includes(qq) ||
      p.title.toLowerCase().includes(qq) ||
      prettyType(p.property_type).toLowerCase().includes(qq)
    );
  });
}

function projectToFallbackMap(p: Property) {
  const x =
    ((p.longitude! - NAIROBI_BOUNDS.minLng) / (NAIROBI_BOUNDS.maxLng - NAIROBI_BOUNDS.minLng)) *
    100;
  const y =
    ((NAIROBI_BOUNDS.maxLat - p.latitude!) / (NAIROBI_BOUNDS.maxLat - NAIROBI_BOUNDS.minLat)) * 100;
  return {
    left: `${Math.min(94, Math.max(6, x))}%`,
    top: `${Math.min(88, Math.max(12, y))}%`,
  };
}

function FallbackMap({
  properties,
  selected,
  showHeat,
  onSelect,
}: {
  properties: Property[];
  selected: Property | null;
  showHeat: boolean;
  onSelect: (property: Property) => void;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e1a14]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(201,168,76,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(201,168,76,0.08)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(13,79,60,0.85),transparent_32%),radial-gradient(circle_at_68%_58%,rgba(201,168,76,0.28),transparent_26%),radial-gradient(circle_at_52%_78%,rgba(255,107,53,0.18),transparent_24%)]" />
      <div className="absolute left-[16%] top-[34%] h-28 w-[68%] rotate-[-14deg] rounded-full border-y border-gold/25" />
      <div className="absolute left-[8%] top-[55%] h-20 w-[86%] rotate-[10deg] rounded-full border-y border-primary/35" />

      {["Westlands", "Kilimani", "Lavington", "Karen", "Kasarani"].map((hood, i) => (
        <span
          key={hood}
          className="absolute rounded-full bg-background/10 px-2 py-1 text-[10px] font-semibold text-background/60 backdrop-blur"
          style={{
            left: `${[30, 45, 39, 24, 72][i]}%`,
            top: `${[36, 51, 44, 66, 26][i]}%`,
          }}
        >
          {hood}
        </span>
      ))}

      {showHeat &&
        properties.map((p) => {
          const point = projectToFallbackMap(p);
          const size = Math.min(120, 44 + p.rent_kes / 2500);
          return (
            <span
              key={`heat-${p.id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/20 blur-md"
              style={{ ...point, width: size, height: size }}
            />
          );
        })}

      {properties.map((p) => {
        const point = projectToFallbackMap(p);
        const active = selected?.id === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`absolute -translate-x-1/2 -translate-y-full rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-elegant transition ${
              active
                ? "z-20 border-background bg-gradient-gold text-gold-foreground"
                : "z-10 border-background/70 bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
            style={point}
            aria-label={`${p.title}, ${formatKes(p.rent_kes)}`}
          >
            {compactKes(p.rent_kes).replace("KES ", "")}
          </button>
        );
      })}
    </div>
  );
}

function compactKes(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${Math.round(n / 1_000)}K`;
  return `KES ${n}`;
}

function TenantMap() {
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const clusterer = useRef<MarkerClustererType | null>(null);
  const heatmap = useRef<google.maps.Circle[]>([]);
  const allHeatCircles = useRef<google.maps.Circle[]>([]);
  const rebuildTimer = useRef<number | null>(null);
  const cullRaf = useRef<number | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [query, setQuery] = useState("");
  const [markerCount, setMarkerCount] = useState(0);
  const filteredProperties = filterMappableProperties(properties, query);

  // Init map
  useEffect(() => {
    if (!BROWSER_KEY) {
      setError("Google Maps key missing. Connect Google Maps Platform.");
      return;
    }
    if (error) return;
    let cancelled = false;
    const mapsWindow = getGoogleMapsWindow();
    const previousAuthFailure = mapsWindow.gm_authFailure;
    mapsWindow.gm_authFailure = () => {
      previousAuthFailure?.();
      if (!cancelled) {
        setReady(false);
        setError("Google Maps key is not authorized for this domain.");
      }
    };
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current || error) return;
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
      mapsWindow.gm_authFailure = previousAuthFailure;
    };
  }, [error]);

  // Render markers + clusters + heatmap whenever data or filters change (throttled)
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    if (rebuildTimer.current) window.clearTimeout(rebuildTimer.current);
    rebuildTimer.current = window.setTimeout(() => {
      void rebuild();
    }, 150);

    async function rebuild() {
      const g = getGoogleMapsWindow().google;
      if (!g) return;
      const map = mapInstance.current!;
      const mcMod = (await import("@googlemaps/markerclusterer")) as MarkerClustererModule;
      const MarkerClusterer = mcMod.MarkerClusterer ?? mcMod.default?.MarkerClusterer;
      const SuperClusterAlgorithm =
        mcMod.SuperClusterAlgorithm ?? mcMod.default?.SuperClusterAlgorithm;
      if (!MarkerClusterer || !SuperClusterAlgorithm) {
        throw new Error("Marker clusterer failed to load");
      }

      clusterer.current?.clearMarkers();
      markers.current.forEach((m) => m.setMap(null));
      markers.current = [];
      setMarkerCount(0);

      const filtered = filterMappableProperties(properties, query);

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
        (marker as PropertyMarker).__property = p;
        return marker;
      });
      markers.current = newMarkers;
      setMarkerCount(newMarkers.length);

      clusterer.current = new MarkerClusterer({
        map,
        markers: newMarkers,
        algorithm: new SuperClusterAlgorithm({ radius: 70, maxZoom: 15 }),
        renderer: {
          render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
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

      // Compress overlay data: snap to a coarse grid, sum weights → far fewer circles
      allHeatCircles.current.forEach((c) => c.setMap(null));
      allHeatCircles.current = [];
      heatmap.current = [];

      if (filtered.length) {
        const maxRent = Math.max(...filtered.map((p) => p.rent_kes));
        const CELL = 0.004; // ~400m grid
        const grid = new Map<string, { lat: number; lng: number; w: number; n: number }>();
        for (const p of filtered) {
          const gx = Math.round(p.latitude! / CELL);
          const gy = Math.round(p.longitude! / CELL);
          const key = `${gx}:${gy}`;
          const w = 0.4 + (p.rent_kes / maxRent) * 1.6;
          const cell = grid.get(key);
          if (cell) {
            cell.lat += p.latitude!;
            cell.lng += p.longitude!;
            cell.w += w;
            cell.n += 1;
          } else {
            grid.set(key, { lat: p.latitude!, lng: p.longitude!, w, n: 1 });
          }
        }

        const layers = [
          { mult: 1.0, color: "#ff6b35", opacity: 0.22 },
          { mult: 1.8, color: "#e8b84a", opacity: 0.14 },
          { mult: 2.8, color: "#0d4f3c", opacity: 0.1 },
        ];
        const circles: google.maps.Circle[] = [];
        grid.forEach((cell) => {
          const center = { lat: cell.lat / cell.n, lng: cell.lng / cell.n };
          const weight = Math.min(3.5, cell.w);
          layers.forEach(({ mult, color, opacity }) => {
            circles.push(
              new g.maps.Circle({
                center,
                radius: 140 * weight * mult,
                strokeOpacity: 0,
                fillColor: color,
                fillOpacity: opacity,
                clickable: false,
                map: null,
              }),
            );
          });
        });
        allHeatCircles.current = circles;
        if (showHeat) cullHeatmap();
      }
    }
  }, [ready, properties, query, showHeat]);

  // Viewport culling: only attach circles whose center is in the visible bounds.
  function cullHeatmap() {
    const map = mapInstance.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) {
      allHeatCircles.current.forEach((c) => c.setMap(map));
      heatmap.current = allHeatCircles.current;
      return;
    }
    const visible: google.maps.Circle[] = [];
    for (const c of allHeatCircles.current) {
      const center = c.getCenter();
      const inView = center ? bounds.contains(center) : false;
      c.setMap(inView ? map : null);
      if (inView) visible.push(c);
    }
    heatmap.current = visible;
  }

  // Re-cull on map idle (throttled via rAF) so pan/zoom stays smooth.
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;
    const schedule = () => {
      if (cullRaf.current) cancelAnimationFrame(cullRaf.current);
      cullRaf.current = requestAnimationFrame(() => {
        if (showHeat) cullHeatmap();
      });
    };
    const listener = map.addListener("idle", schedule);
    return () => {
      listener.remove();
      if (cullRaf.current) cancelAnimationFrame(cullRaf.current);
    };
  }, [ready, showHeat]);

  // Toggle heatmap visibility without rebuilding
  useEffect(() => {
    if (!mapInstance.current) return;
    if (showHeat) {
      cullHeatmap();
    } else {
      allHeatCircles.current.forEach((c) => c.setMap(null));
      heatmap.current = [];
    }
  }, [showHeat]);

  // Highlight selected marker
  useEffect(() => {
    const g = getGoogleMapsWindow().google;
    if (!g) return;
    markers.current.forEach((m) => {
      const p = (m as PropertyMarker).__property;
      if (!p) return;
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
    setSelected(null);
  };

  const visibleCount = ready && !error ? markerCount : filteredProperties.length;

  return (
    <div className="relative h-[calc(100vh-5.5rem)] overflow-hidden bg-secondary">
      {error ? (
        <FallbackMap
          properties={filteredProperties}
          selected={selected}
          showHeat={showHeat}
          onSelect={setSelected}
        />
      ) : (
        <div ref={mapRef} className="absolute inset-0" />
      )}

      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center bg-secondary/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm shadow-card">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Loading Nairobi map…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-4 top-24 z-10 rounded-2xl border bg-card/95 p-3 text-xs shadow-card backdrop-blur">
          <p className="font-semibold text-foreground">Fallback map active</p>
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
              showHeat
                ? "bg-gradient-gold text-gold-foreground"
                : "bg-background/90 text-foreground"
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> Heatmap {showHeat ? "on" : "off"}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-card backdrop-blur">
            <Layers className="h-3.5 w-3.5" /> {visibleCount} listings
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
