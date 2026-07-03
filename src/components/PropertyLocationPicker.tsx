import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import { resolveMapboxToken } from "@/hooks/use-tenant-mapbox";
import { neighborhoodCentroid } from "@/lib/geo/property-map-coords";
import { NAIROBI_CENTER } from "@/components/tenant-map/map-constants";
import { enableMapbox3D, fitMapboxToKenya, MAPBOX_3D_INIT } from "@/lib/mapbox/mapbox-3d";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

type PropertyLocationPickerProps = Readonly<{
  latitude: number | null;
  longitude: number | null;
  neighborhood?: string;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}>;

function flyToPin(map: MapboxMap, lng: number, lat: number) {
  map.flyTo({
    center: [lng, lat],
    zoom: 15.5,
    pitch: 58,
    bearing: -20,
    duration: 1200,
    essential: true,
  });
}

export function PropertyLocationPicker({
  latitude,
  longitude,
  neighborhood,
  onChange,
  className,
}: PropertyLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = await resolveMapboxToken();
      if (cancelled) return;
      if (!token) {
        setError("Map unavailable — enter coordinates manually below or set VITE_MAPBOX_TOKEN.");
        setLoading(false);
        return;
      }

      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = token;

      const centroid = neighborhood ? neighborhoodCentroid(neighborhood) : null;
      const hasPin = latitude != null && longitude != null;
      const center = {
        lng: hasPin ? longitude! : (centroid?.lng ?? NAIROBI_CENTER.lng),
        lat: hasPin ? latitude! : (centroid?.lat ?? NAIROBI_CENTER.lat),
      };

      const map = new mapboxgl.Map({
        container: mapRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [center.lng, center.lat],
        zoom: hasPin ? 14 : 5.5,
        ...MAPBOX_3D_INIT,
      });

      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
        "top-right",
      );

      const placeMarker = (lng: number, lat: number) => {
        markerRef.current?.remove();
        const marker = new mapboxgl.Marker({ color: "#0d4f3c", draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          onChangeRef.current(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      };

      const onLoad = () => {
        if (cancelled) return;
        enableMapbox3D(map);
        map.resize();
        if (latitude != null && longitude != null) {
          placeMarker(longitude, latitude);
          flyToPin(map, longitude, latitude);
        } else if (centroid) {
          map.flyTo({
            center: [centroid.lng, centroid.lat],
            zoom: 13,
            pitch: 50,
            duration: 800,
          });
        } else {
          fitMapboxToKenya(map, { padding: 24, pitch: 45, duration: 0, maxZoom: 6.5 });
        }
        setLoading(false);
      };

      map.on("load", onLoad);
      map.on("style.load", () => enableMapbox3D(map));

      map.on("click", (e) => {
        placeMarker(e.lngLat.lng, e.lngLat.lat);
        onChangeRef.current(e.lngLat.lat, e.lngLat.lng);
        flyToPin(map, e.lngLat.lng, e.lngLat.lat);
      });

      mapInstance.current = map;

      if (mapRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserverRef.current = new ResizeObserver(() => map.resize());
        resizeObserverRef.current.observe(mapRef.current);
      }
    }

    void init();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
    // Mount-only map init; lat/lng updates handled in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || latitude == null || longitude == null) return;
    markerRef.current?.setLngLat([longitude, latitude]);
    flyToPin(map, longitude, latitude);
  }, [latitude, longitude]);

  useEffect(() => {
    if (!neighborhood || latitude != null) return;
    const centroid = neighborhoodCentroid(neighborhood);
    if (!centroid) return;
    mapInstance.current?.flyTo({
      center: [centroid.lng, centroid.lat],
      zoom: 13,
      pitch: 50,
      duration: 900,
    });
  }, [neighborhood, latitude]);

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => setError("Could not access your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function useNeighborhoodCenter() {
    if (!neighborhood?.trim()) {
      setError("Enter a neighborhood on the Details tab first.");
      return;
    }
    const centroid = neighborhoodCentroid(neighborhood);
    if (!centroid) {
      setError("Could not resolve that neighborhood — pin manually on the map.");
      return;
    }
    setError(null);
    onChange(centroid.lat, centroid.lng);
  }

  function showKenyaOverview() {
    const map = mapInstance.current;
    if (!map) return;
    fitMapboxToKenya(map, { padding: 24, pitch: 45, duration: 1000, maxZoom: 6.5 });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Click the map to drop a pin, drag to refine, or tilt with right-click / two-finger drag
          for 3D view.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={showKenyaOverview}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <MapPin className="h-3.5 w-3.5" /> Kenya overview
          </button>
          <button
            type="button"
            onClick={useNeighborhoodCenter}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <MapPin className="h-3.5 w-3.5" /> Use neighborhood center
          </button>
          <button
            type="button"
            onClick={locateMe}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <Navigation className="h-3.5 w-3.5" /> Use my location
          </button>
        </div>
      </div>

      <div className="relative min-h-[22rem] h-[min(70vh,36rem)] overflow-hidden rounded-xl border">
        {loading ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <div ref={mapRef} className="absolute inset-0 touch-none" />
        {!loading && latitude == null ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium text-background">
              <MapPin className="h-3.5 w-3.5" /> Tap map to pin location
            </span>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-amber-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Latitude</span>
          <input
            type="number"
            step="any"
            value={latitude ?? ""}
            onChange={(e) => {
              const lat = Number(e.target.value);
              const lng = longitude ?? NAIROBI_CENTER.lng;
              if (Number.isFinite(lat)) onChange(lat, lng);
            }}
            placeholder="-1.2921"
            className="rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Longitude</span>
          <input
            type="number"
            step="any"
            value={longitude ?? ""}
            onChange={(e) => {
              const lng = Number(e.target.value);
              const lat = latitude ?? NAIROBI_CENTER.lat;
              if (Number.isFinite(lng)) onChange(lat, lng);
            }}
            placeholder="36.8219"
            className="rounded-xl border px-3 py-2"
          />
        </label>
      </div>
    </div>
  );
}
