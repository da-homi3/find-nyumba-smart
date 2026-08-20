import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { type Property, type PropertySearchFilters } from "@/lib/properties";
import { useListingsSearch } from "@/hooks/use-listings-search";
import { MAP_LISTINGS_FILTERS, MAP_LISTINGS_LIMIT } from "@/lib/tenant-section-prefetch";
import { FallbackMap } from "@/components/tenant-map/FallbackMap";
import {
  filterMappableProperties,
  filterPropertiesNearPlace,
} from "@/components/tenant-map/map-constants";
import { TenantMapChrome } from "@/components/tenant-map/TenantMapChrome";
import { useTenantGoogleMap } from "@/hooks/use-tenant-google-map";
import { hasMapboxTokenSync, resolveMapboxToken, useTenantMapbox } from "@/hooks/use-tenant-mapbox";
import { SSR_SAFE_MOTION_INITIAL } from "@/lib/design/motion";
import { canUseWebGl, mapLoadTimeoutMs } from "@/lib/mapbox/map-device";
import { mergeListingsForDisplay } from "@/lib/listings-preview";
import { createPlaceFocus, type MapPlaceFocus, type LocationSearchResult } from "@/lib/geo/location-search";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function hasGoogleMapsKeySync(): boolean {
  return Boolean(GOOGLE_MAPS_KEY?.trim());
}

function boundsAround(lat: number, lng: number, radiusKm: number): PropertySearchFilters["bounds"] {
  const d = Math.min(Math.max(radiusKm, 1), 25) / 111;
  return {
    minLat: lat - d,
    maxLat: lat + d,
    minLng: lng - d,
    maxLng: lng + d,
  };
}

type MapProvider = "loading" | "mapbox" | "google" | "fallback";
type MapHookResult = ReturnType<typeof useTenantGoogleMap>;
type TenantMapViewProps = Readonly<{
  properties: Property[];
  propertiesLoading: boolean;
  onPlaceBounds?: (bounds: PropertySearchFilters["bounds"] | undefined) => void;
}>;

function resolveInitialProvider(): MapProvider {
  return hasMapboxTokenSync() ? "mapbox" : "loading";
}

function MapLoadingState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="tenant-map-viewport relative overflow-hidden bg-[#0c1a12]">
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
        <motion.span
          initial={SSR_SAFE_MOTION_INITIAL}
          animate={{ opacity: 1 }}
          className="text-center text-base text-white/70"
        >
          {message}
        </motion.span>
      </div>
    </div>
  );
}

export function TenantMapApp() {
  const [placeBounds, setPlaceBounds] = useState<PropertySearchFilters["bounds"]>();
  const listingFilters = useMemo(
    () => ({
      ...MAP_LISTINGS_FILTERS,
      ...(placeBounds
        ? { bounds: placeBounds, limit: Math.max(MAP_LISTINGS_LIMIT, 200) }
        : {}),
    }),
    [placeBounds],
  );
  const {
    data: searchResult,
    isLoading: propertiesLoading,
    isError,
    error,
    refetch,
  } = useListingsSearch(listingFilters);
  const properties = useMemo(
    () => mergeListingsForDisplay(searchResult?.items ?? []),
    [searchResult?.items],
  );

  const [provider, setProvider] = useState<MapProvider>(resolveInitialProvider);

  useEffect(() => {
    if (provider !== "loading") return;

    if (!canUseWebGl()) {
      setProvider(hasGoogleMapsKeySync() ? "google" : "fallback");
      return;
    }

    let cancelled = false;
    void resolveMapboxToken()
      .then((token) => {
        if (cancelled) return;
        if (token) setProvider("mapbox");
        else if (hasGoogleMapsKeySync()) setProvider("google");
        else setProvider("fallback");
      })
      .catch(() => {
        if (!cancelled) setProvider(hasGoogleMapsKeySync() ? "google" : "fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [provider]);

  if (isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold">Couldn&apos;t load listings</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Check your connection and try again."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (provider === "loading") {
    return <MapLoadingState message="Loading map…" />;
  }

  if (provider === "mapbox") {
    return (
      <TenantMapboxView
        properties={properties}
        propertiesLoading={propertiesLoading}
        onPlaceBounds={setPlaceBounds}
      />
    );
  }

  if (provider === "google") {
    return (
      <TenantGoogleMapView
        properties={properties}
        propertiesLoading={propertiesLoading}
        onPlaceBounds={setPlaceBounds}
      />
    );
  }

  return (
    <TenantFallbackMapView
      properties={properties}
      propertiesLoading={propertiesLoading}
      onPlaceBounds={setPlaceBounds}
    />
  );
}

function TenantFallbackMapView({
  properties,
  propertiesLoading,
  onPlaceBounds,
}: TenantMapViewProps) {
  const [selected, setSelected] = useState<Property | null>(null);
  const [query, setQuery] = useState("");
  const [placeFocus, setPlaceFocus] = useState<MapPlaceFocus | null>(null);
  const [showHeat, setShowHeat] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const filtered = placeFocus
    ? filterPropertiesNearPlace(properties, placeFocus.lat, placeFocus.lng, placeFocus.radiusKm)
    : filterMappableProperties(properties, query);

  function applyPlace(place: LocationSearchResult) {
    const focus = createPlaceFocus(place);
    setPlaceFocus(focus);
    setQuery(place.neighborhood ?? place.label);
    onPlaceBounds?.(boundsAround(focus.lat, focus.lng, focus.radiusKm));
  }

  return (
    <TenantMapShell
      map={{
        mapRef: { current: null },
        ready: true,
        error: null,
        selected,
        setSelected,
        showHeat,
        setShowHeat,
        showWater: false,
        setShowWater: () => undefined,
        showSecurity: false,
        setShowSecurity: () => undefined,
        panelOpen,
        setPanelOpen,
        query,
        setQuery,
        placeFocus,
        focusPlace: applyPlace,
        clearPlaceFocus: () => {
          setPlaceFocus(null);
          setQuery("");
          onPlaceBounds?.(undefined);
        },
        filteredProperties: filtered,
        visibleCount: filtered.length,
        locateMe: () => undefined,
        recenter: () => {
          setPlaceFocus(null);
          setSelected(null);
          onPlaceBounds?.(undefined);
        },
        isOnline: true,
        searchProximity: { lat: -1.286389, lng: 36.817223 },
      }}
      propertiesLoading={propertiesLoading}
      provider="google"
      startInFallback
    />
  );
}

function TenantMapboxView({ properties, propertiesLoading, onPlaceBounds }: TenantMapViewProps) {
  const [mapEpoch, setMapEpoch] = useState(0);
  return (
    <TenantMapboxViewInner
      key={mapEpoch}
      properties={properties}
      propertiesLoading={propertiesLoading}
      onPlaceBounds={onPlaceBounds}
      onHardRetry={() => setMapEpoch((n) => n + 1)}
    />
  );
}

function TenantMapboxViewInner({
  properties,
  propertiesLoading,
  onPlaceBounds,
  onHardRetry,
}: TenantMapViewProps & { onHardRetry: () => void }) {
  const map = useTenantMapbox(properties);
  const wrapped = useMemo(() => {
    const focusPlace = (place: LocationSearchResult) => {
      map.focusPlace?.(place);
      const focus = createPlaceFocus(place);
      onPlaceBounds?.(boundsAround(focus.lat, focus.lng, focus.radiusKm));
    };
    const clearPlaceFocus = () => {
      map.clearPlaceFocus?.();
      onPlaceBounds?.(undefined);
    };
    const recenter = () => {
      map.recenter?.();
      onPlaceBounds?.(undefined);
    };
    return { ...map, focusPlace, clearPlaceFocus, recenter };
  }, [map, onPlaceBounds]);
  return (
    <TenantMapShell
      map={wrapped}
      propertiesLoading={propertiesLoading}
      onCycleStyle={map.cycleMapStyle}
      provider="mapbox"
      onHardRetry={onHardRetry}
    />
  );
}

function TenantGoogleMapView({ properties, propertiesLoading, onPlaceBounds }: TenantMapViewProps) {
  const [mapEpoch, setMapEpoch] = useState(0);
  return (
    <TenantGoogleMapViewInner
      key={mapEpoch}
      properties={properties}
      propertiesLoading={propertiesLoading}
      onPlaceBounds={onPlaceBounds}
      onHardRetry={() => setMapEpoch((n) => n + 1)}
    />
  );
}

function TenantGoogleMapViewInner({
  properties,
  propertiesLoading,
  onPlaceBounds,
  onHardRetry,
}: TenantMapViewProps & { onHardRetry: () => void }) {
  const map = useTenantGoogleMap(properties);
  const wrapped = useMemo(() => {
    const focusPlace = (place: LocationSearchResult) => {
      map.focusPlace?.(place);
      const focus = createPlaceFocus(place);
      onPlaceBounds?.(boundsAround(focus.lat, focus.lng, focus.radiusKm));
    };
    const clearPlaceFocus = () => {
      map.clearPlaceFocus?.();
      onPlaceBounds?.(undefined);
    };
    const recenter = () => {
      map.recenter?.();
      onPlaceBounds?.(undefined);
    };
    return { ...map, focusPlace, clearPlaceFocus, recenter };
  }, [map, onPlaceBounds]);
  return (
    <TenantMapShell
      map={wrapped}
      propertiesLoading={propertiesLoading}
      provider="google"
      onHardRetry={onHardRetry}
    />
  );
}

function TenantMapShell({
  map,
  propertiesLoading,
  onCycleStyle,
  provider,
  startInFallback = false,
  onHardRetry,
}: Readonly<{
  map: MapHookResult & { cycleMapStyle?: () => void };
  propertiesLoading: boolean;
  onCycleStyle?: () => void;
  provider: "mapbox" | "google";
  startInFallback?: boolean;
  onHardRetry?: () => void;
}>) {
  const [timedOut, setTimedOut] = useState(false);

  // Real map finished — never keep the simplified overlay stuck on top.
  useEffect(() => {
    if (map.ready) setTimedOut(false);
  }, [map.ready]);

  useEffect(() => {
    if (startInFallback || map.ready || map.error) return;
    const timer = globalThis.setTimeout(() => setTimedOut(true), mapLoadTimeoutMs());
    return () => globalThis.clearTimeout(timer);
  }, [startInFallback, map.ready, map.error]);

  const showSimplifiedOverlay = startInFallback || Boolean(map.error) || (timedOut && !map.ready);
  const loadingMessage = propertiesLoading ? "Loading listings…" : "Loading map…";
  const showBootLoader = !startInFallback && !map.ready && !showSimplifiedOverlay;
  const overlayMessage = (() => {
    if (map.error) return map.error;
    if (timedOut && !map.ready) {
      return "Map is taking longer than usual — keeping pins available while streets load";
    }
    return "Simplified map — streets unavailable on this device";
  })();

  // When the overlay clears after a slow load, force a canvas resize.
  useEffect(() => {
    if (showSimplifiedOverlay || !map.ready) return;
    requestAnimationFrame(() => {
      globalThis.dispatchEvent(new Event("resize"));
    });
  }, [showSimplifiedOverlay, map.ready]);

  return (
    <div className="tenant-map-viewport relative overflow-hidden bg-(--color-obsidian)">
      <motion.div
        className="absolute inset-0"
        initial={SSR_SAFE_MOTION_INITIAL}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        {/* Keep the live map mounted under any overlay so a slow load can still succeed. */}
        {startInFallback ? null : <MapCanvas mapRef={map.mapRef} />}
        {showSimplifiedOverlay ? (
          <div className="absolute inset-0 z-5">
            <FallbackMap
              properties={map.filteredProperties}
              selected={map.selected}
              showHeat={map.showHeat}
              onSelect={map.setSelected}
              statusMessage={overlayMessage}
              onRetry={
                onHardRetry
                  ? () => {
                      setTimedOut(false);
                      onHardRetry();
                    }
                  : undefined
              }
            />
          </div>
        ) : null}
      </motion.div>

      {showBootLoader ? (
        <MapOverlay>
          <div className="relative flex h-48 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl bg-[#0c1a12] px-4">
            <span className="text-center text-sm text-white/75">{loadingMessage}</span>
          </div>
        </MapOverlay>
      ) : null}

      {onCycleStyle && map.ready && !showSimplifiedOverlay ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          onClick={onCycleStyle}
          className="absolute top-20 right-4 z-20 rounded-xl border border-white/10 bg-[rgba(13,17,23,0.85)] px-3 py-2 text-xs font-semibold text-white backdrop-blur-xl"
        >
          Map style
        </motion.button>
      ) : null}

      <TenantMapChrome
        query={map.query}
        onQueryChange={map.setQuery}
        placeFocus={map.placeFocus ?? null}
        onSelectPlace={(place) => map.focusPlace?.(place)}
        onClearPlace={() => map.clearPlaceFocus?.()}
        showHeat={map.showHeat}
        onToggleHeat={() => map.setShowHeat((v) => !v)}
        showWater={map.showWater}
        onToggleWater={() => map.setShowWater((v) => !v)}
        showSecurity={map.showSecurity}
        onToggleSecurity={() => map.setShowSecurity((v) => !v)}
        visibleCount={map.visibleCount}
        onLocateMe={map.locateMe}
        onRecenter={map.recenter}
        isOnline={map.isOnline}
        error={showSimplifiedOverlay ? null : map.error}
        filteredProperties={map.filteredProperties}
        panelOpen={map.panelOpen}
        onTogglePanel={() => map.setPanelOpen((v) => !v)}
        selected={map.selected}
        onSelect={map.setSelected}
        onClearSelected={() => map.setSelected(null)}
        mapProvider={provider}
        searchProximity={map.searchProximity}
      />
    </div>
  );
}

function MapCanvas({ mapRef }: Readonly<{ mapRef: React.RefObject<HTMLDivElement | null> }>) {
  return <div ref={mapRef} className="absolute inset-0 h-full min-h-0 w-full" />;
}

function MapOverlay({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-(--color-obsidian)/80 backdrop-blur-sm">
      {children}
    </div>
  );
}
