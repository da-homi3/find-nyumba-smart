import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import { resolveMapboxToken } from "@/hooks/use-tenant-mapbox";
import { neighborhoodCentroid } from "@/lib/geo/property-map-coords";
import { searchLocations, type LocationSearchResult } from "@/lib/geo/location-search";
import { NAIROBI_CENTER } from "@/components/tenant-map/map-constants";
import {
  createPropertyLocationMap,
  flyToPin,
  syncPropertyLocationPin,
} from "@/lib/mapbox/property-location-map";
import { fitMapboxToKenya } from "@/lib/mapbox/mapbox-3d";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type PropertyLocationPickerProps = Readonly<{
  latitude: number | null;
  longitude: number | null;
  neighborhood?: string;
  onChange: (lat: number, lng: number) => void;
  onNeighborhoodSelect?: (neighborhood: string) => void;
  className?: string;
}>;

function LocationSearchDropdown({
  searchLoading,
  searchResults,
  onSelect,
}: Readonly<{
  searchLoading: boolean;
  searchResults: LocationSearchResult[];
  onSelect: (result: LocationSearchResult) => void;
}>) {
  if (searchLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Searching locations…
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-muted-foreground">
        No locations found. Try a different spelling or pin manually on the map.
      </p>
    );
  }

  return (
    <ul className="py-1">
      {searchResults.map((result) => (
        <li key={result.id}>
          <button
            type="button"
            onClick={() => onSelect(result)}
            className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-secondary/70"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{result.label}</span>
              {result.subtitle ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {result.subtitle}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PropertyLocationPicker({
  latitude,
  longitude,
  neighborhood,
  onChange,
  onNeighborhoodSelect,
  className,
}: PropertyLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mapTokenRef = useRef<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(neighborhood ?? "");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchLocations(query, { mapboxToken: mapTokenRef.current, limit: 8 }).then(
        (results) => {
          if (cancelled) return;
          setSearchResults(results);
          setSearchLoading(false);
        },
      );
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectSearchResult(result: LocationSearchResult) {
    setError(null);
    setSearchQuery(result.neighborhood ?? result.label);
    setSearchOpen(false);
    setSearchResults([]);
    onChange(result.lat, result.lng);
    if (result.neighborhood) {
      onNeighborhoodSelect?.(result.neighborhood);
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
    fitMapboxToKenya(map, { padding: 24, pitch: 0, duration: 1000, maxZoom: 6.5 });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div ref={searchRef} className="relative">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Search location</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Type area name, e.g. Kilimani, Westlands, Karen, Mombasa"
              className="w-full rounded-xl border py-2.5 pl-10 pr-3"
              autoComplete="off"
            />
          </div>
        </label>

        {searchOpen && searchQuery.trim().length >= 2 ? (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-card shadow-elegant">
            <LocationSearchDropdown
              searchLoading={searchLoading}
              searchResults={searchResults}
              onSelect={selectSearchResult}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Search above, click the map to drop a pin, or drag to refine the exact spot.
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
