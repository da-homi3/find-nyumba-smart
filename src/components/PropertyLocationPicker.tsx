import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import { resolveMapboxToken } from "@/hooks/use-tenant-mapbox";
import { neighborhoodCentroid } from "@/lib/geo/property-map-coords";
import type { LocationSearchResult } from "@/lib/geo/location-search";
import { PlaceSearchField } from "@/components/PlaceSearchField";
import { NAIROBI_CENTER } from "@/components/tenant-map/map-constants";
import {
  createPropertyLocationMap,
  flyToPin,
  syncPropertyLocationPin,
} from "@/lib/mapbox/property-location-map";
import { fitMapboxToKenya } from "@/lib/mapbox/mapbox-3d";
import { suggestNeighborhoodFromCoords } from "@/lib/listings/suggest-neighborhood";
import { suggestListingNeighborhood } from "@/lib/api/listing-ai.functions";
import { Loader2, MapPin, Navigation, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type PropertyLocationPickerProps = Readonly<{
  latitude: number | null;
  longitude: number | null;
  neighborhood?: string;
  address?: string;
  onChange: (lat: number, lng: number) => void;
  onNeighborhoodSelect?: (neighborhood: string) => void;
  className?: string;
}>;

export function PropertyLocationPicker({
  latitude,
  longitude,
  neighborhood,
  address,
  onChange,
  onNeighborhoodSelect,
  className,
}: PropertyLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mapTokenRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(neighborhood ?? "");
  const [aiBusy, setAiBusy] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onNeighborhoodSelectRef = useRef(onNeighborhoodSelect);
  onNeighborhoodSelectRef.current = onNeighborhoodSelect;
  const lastAutoNeighborhoodRef = useRef<string>("");
  const neighborhoodManualRef = useRef(Boolean(neighborhood?.trim()));
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = mapRef.current;
    if (!container) return;

    void (async () => {
      const token = await resolveMapboxToken();
      if (cancelled) return;
      mapTokenRef.current = token;
      if (!token) {
        setError("Map unavailable — enter coordinates manually below or set VITE_MAPBOX_TOKEN.");
        setLoading(false);
        return;
      }

      const map = await createPropertyLocationMap({
        container,
        token,
        latitude,
        longitude,
        neighborhood,
        markerRef,
        onPinChange: (lat, lng) => onChangeRef.current(lat, lng),
        onReady: () => {
          if (!cancelled) setLoading(false);
        },
        isCancelled: () => cancelled,
      });

      if (cancelled || !map) return;
      mapInstance.current = map;

      if (typeof ResizeObserver !== "undefined") {
        resizeObserverRef.current = new ResizeObserver(() => map.resize());
        resizeObserverRef.current.observe(container);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapInstance.current?.remove();
      mapInstance.current = null;
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
    // Mount-only map init; lat/lng updates handled in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || latitude == null || longitude == null) return;
    void syncPropertyLocationPin(map, markerRef, longitude, latitude, onChangeRef.current).then(
      () => flyToPin(map, longitude, latitude),
    );
  }, [latitude, longitude]);

  useEffect(() => {
    if (!neighborhood || latitude != null) return;
    const centroid = neighborhoodCentroid(neighborhood);
    if (!centroid) return;
    mapInstance.current?.flyTo({
      center: [centroid.lng, centroid.lat],
      zoom: 13,
      pitch: 0,
      duration: 900,
    });
  }, [neighborhood, latitude]);

  useEffect(() => {
    if (neighborhood && !searchQuery.trim()) {
      setSearchQuery(neighborhood);
    }
  }, [neighborhood, searchQuery]);

  /** Auto-fill neighborhood from pin via catalog, then NyumbaAI if needed. */
  useEffect(() => {
    if (latitude == null || longitude == null || !onNeighborhoodSelectRef.current) return;
    const current = neighborhood?.trim() ?? "";
    const canOverwrite =
      !current || current === lastAutoNeighborhoodRef.current || !neighborhoodManualRef.current;
    if (!canOverwrite) return;

    const local = suggestNeighborhoodFromCoords(latitude, longitude);
    if (!local) return;

    lastAutoNeighborhoodRef.current = local.neighborhood;
    neighborhoodManualRef.current = false;
    setSearchQuery(local.neighborhood);
    onNeighborhoodSelectRef.current(local.neighborhood);
    setAutoNote(
      local.confidence === "high"
        ? `Matched ${local.neighborhood} from the map pin`
        : `Suggested ${local.neighborhood} — refining with NyumbaAI…`,
    );

    if (local.confidence === "high") return;

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    const pinLat = latitude;
    const pinLng = longitude;
    aiTimerRef.current = setTimeout(() => {
      void (async () => {
        setAiBusy(true);
        try {
          const res = await suggestListingNeighborhood({
            data: {
              latitude: pinLat,
              longitude: pinLng,
              address: address || undefined,
            },
          });
          if (!res.neighborhood) return;
          const stillOk =
            !neighborhoodManualRef.current ||
            (neighborhood?.trim() ?? "") === lastAutoNeighborhoodRef.current;
          if (!stillOk) return;
          lastAutoNeighborhoodRef.current = res.neighborhood;
          setSearchQuery(res.neighborhood);
          onNeighborhoodSelectRef.current?.(res.neighborhood);
          setAutoNote(`NyumbaAI set neighborhood to ${res.neighborhood}`);
        } catch {
          setAutoNote(`Using ${local.neighborhood} from map pin`);
        } finally {
          setAiBusy(false);
        }
      })();
    }, 650);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [latitude, longitude, address, neighborhood]);

  function selectSearchResult(result: LocationSearchResult) {
    setError(null);
    setSearchQuery(result.neighborhood ?? result.label);
    neighborhoodManualRef.current = true;
    setAutoNote(null);
    onChange(result.lat, result.lng);
    if (result.neighborhood) {
      onNeighborhoodSelect?.(result.neighborhood);
    } else if (result.kind === "neighborhood" || result.kind === "locality") {
      onNeighborhoodSelect?.(result.label);
    }
    const map = mapInstance.current;
    if (!map) return;
    void syncPropertyLocationPin(map, markerRef, result.lng, result.lat, onChangeRef.current).then(
      () => flyToPin(map, result.lng, result.lat),
    );
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        neighborhoodManualRef.current = false;
        onChange(pos.coords.latitude, pos.coords.longitude);
      },
      () => setError("Could not access your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function detectWithNyumbaAI() {
    if (latitude == null || longitude == null) {
      setError("Drop a map pin first, then detect the neighborhood.");
      return;
    }
    setAiBusy(true);
    setError(null);
    try {
      const res = await suggestListingNeighborhood({
        data: {
          latitude,
          longitude,
          address: address || searchQuery || undefined,
        },
      });
      if (!res.neighborhood) {
        setError("NyumbaAI could not detect a neighborhood for this pin.");
        return;
      }
      neighborhoodManualRef.current = false;
      lastAutoNeighborhoodRef.current = res.neighborhood;
      setSearchQuery(res.neighborhood);
      onNeighborhoodSelect?.(res.neighborhood);
      setAutoNote(`NyumbaAI set neighborhood to ${res.neighborhood}`);
    } catch {
      setError("NyumbaAI neighborhood detection failed. Try again.");
    } finally {
      setAiBusy(false);
    }
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
    fitMapboxToKenya(map, { padding: 24, pitch: 0, duration: 1000, maxZoom: 6.5 });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-xl border bg-card p-3 shadow-soft">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Search location</span>
          <PlaceSearchField
            value={searchQuery}
            onValueChange={(value) => {
              neighborhoodManualRef.current = true;
              setSearchQuery(value);
              setAutoNote(null);
            }}
            onSelectPlace={selectSearchResult}
            onClear={() => setSearchQuery("")}
            placeholder="Search landmark, road, or area — e.g. Junction Mall, Ngong Rd, Karen"
            className="rounded-xl border px-3 py-1"
            showNearbyAfterSelect
            proximity={
              latitude != null && longitude != null
                ? { lat: latitude, lng: longitude }
                : NAIROBI_CENTER
            }
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Pick a place like Google Maps, then drag the pin to the exact building. NyumbaAI fills
          the neighborhood from the pin automatically.
        </p>
        {autoNote ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary">
            {aiBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {autoNote}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Search above, click the map to drop a pin, or drag to refine the exact spot.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void detectWithNyumbaAI()}
            disabled={aiBusy || latitude == null || longitude == null}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            {aiBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Detect with NyumbaAI
          </button>
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

      <div className="relative min-h-88 h-[min(70vh,36rem)] overflow-hidden rounded-xl border">
        {loading ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <div ref={mapRef} className="absolute inset-0 touch-none" />
        {!loading && latitude == null ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium text-background">
              <MapPin className="h-3.5 w-3.5" /> Search or tap map to pin location
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
              neighborhoodManualRef.current = false;
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
              neighborhoodManualRef.current = false;
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
