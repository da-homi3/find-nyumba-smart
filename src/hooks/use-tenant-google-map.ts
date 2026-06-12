/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { getGoogleMapsWindow, loadGoogleMaps } from "@/lib/google-maps-loader";
import type { Property } from "@/lib/properties";
import {
  BROWSER_KEY,
  TRACKING_ID,
  MAP_STYLE,
  NAIROBI_CENTER,
  compactKes,
  filterMappableProperties,
  priceTagSvg,
} from "@/components/tenant-map/map-constants";

type MarkerClustererType = import("@googlemaps/markerclusterer").MarkerClusterer;
type MarkerClustererModule = typeof import("@googlemaps/markerclusterer") & {
  default?: typeof import("@googlemaps/markerclusterer");
};
type PropertyMarker = google.maps.Marker & { __property?: Property };

export function useTenantGoogleMap(properties: Property[]) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const clusterer = useRef<MarkerClustererType | null>(null);
  const heatmap = useRef<google.maps.Circle[]>([]);
  const allHeatCircles = useRef<google.maps.Circle[]>([]);
  const rebuildTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const cullRaf = useRef<number | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showWater, setShowWater] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [markerCount, setMarkerCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const filteredProperties = filterMappableProperties(properties, query);

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

  useEffect(() => {
    if (typeof globalThis.document === "undefined") return;
    const handleOnline = () => {
      setIsOnline(true);
      setError((prev) =>
        prev && /network|connection|load Google Maps|too slow/i.test(prev) ? null : prev,
      );
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (!mapInstance.current) {
        setError((prev) => prev ?? "You're offline. Showing cached listings.");
      }
    };
    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    if (!navigator.onLine) handleOffline();
    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!BROWSER_KEY) {
      setError("Google Maps key missing. Connect Google Maps Platform.");
      return;
    }
    if (error) return;
    if (!isOnline && !getGoogleMapsWindow().google?.maps) {
      setError("You're offline. Showing cached listings.");
      return;
    }
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
    loadGoogleMaps({ apiKey: BROWSER_KEY, trackingId: TRACKING_ID })
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
      .catch((e) => {
        console.warn("[tenant-map] Google Maps load failed:", e);
        setError(e instanceof Error ? e.message : "Failed to load map");
      });
    return () => {
      cancelled = true;
      mapsWindow.gm_authFailure = previousAuthFailure;
    };
  }, [error, isOnline]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    if (rebuildTimer.current) globalThis.clearTimeout(rebuildTimer.current);
    rebuildTimer.current = globalThis.setTimeout(() => {
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
            url: priceTagSvg(compactKes(p.rent_kes).replaceAll("KES ", ""), false),
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

      allHeatCircles.current.forEach((c) => c.setMap(null));
      allHeatCircles.current = [];
      heatmap.current = [];

      if (filtered.length) {
        const maxRent = Math.max(...filtered.map((p) => p.rent_kes));
        const CELL = 0.004;
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

  useEffect(() => {
    if (!mapInstance.current) return;
    if (showHeat) {
      cullHeatmap();
    } else {
      allHeatCircles.current.forEach((c) => c.setMap(null));
      heatmap.current = [];
    }
  }, [showHeat]);

  useEffect(() => {
    const g = getGoogleMapsWindow().google;
    if (!g) return;
    markers.current.forEach((m) => {
      const p = (m as PropertyMarker).__property;
      if (!p) return;
      const isActive = selected?.id === p.id;
      m.setIcon({
        url: priceTagSvg(compactKes(p.rent_kes).replaceAll("KES ", ""), isActive),
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

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapInstance.current?.panTo(center);
        mapInstance.current?.setZoom(14);
      },
      () => setError("Could not access your location"),
    );
  };

  const visibleCount = ready && !error ? markerCount : filteredProperties.length;

  return {
    mapRef,
    ready,
    error,
    selected,
    setSelected,
    showHeat,
    setShowHeat,
    showWater,
    setShowWater,
    showSecurity,
    setShowSecurity,
    panelOpen,
    setPanelOpen,
    query,
    setQuery,
    isOnline,
    filteredProperties,
    visibleCount,
    recenter,
    locateMe,
  };
}
