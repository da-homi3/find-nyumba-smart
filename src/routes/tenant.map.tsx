import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { fetchProperties, type Property } from "@/lib/properties";
import { FallbackMap } from "@/components/tenant-map/FallbackMap";
import { TenantMapChrome } from "@/components/tenant-map/TenantMapChrome";
import { useTenantGoogleMap } from "@/hooks/use-tenant-google-map";
import { hasMapboxTokenSync, resolveMapboxToken, useTenantMapbox } from "@/hooks/use-tenant-mapbox";

export const Route = createFileRoute("/tenant/map")({
  head: () => ({ meta: [{ title: "Map — NyumbaSearch" }] }),
  component: TenantMap,
});

type MapProvider = "loading" | "mapbox" | "google";
type MapHookResult = ReturnType<typeof useTenantGoogleMap>;
type TenantMapViewProps = Readonly<{
  properties: Property[];
  propertiesLoading: boolean;
}>;

function resolveInitialProvider(): MapProvider {
  return hasMapboxTokenSync() ? "mapbox" : "loading";
}

function MapLoadingState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="relative flex h-dvh min-h-screen items-center justify-center bg-(--color-obsidian)">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-(--color-graphite) px-4 py-2 text-sm text-white"
      >
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-[#1eb88a]" aria-hidden />
        <span>{message}</span>
      </motion.div>
    </div>
  );
}

function TenantMap() {
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: () => fetchProperties(),
  });

  const [provider, setProvider] = useState<MapProvider>(resolveInitialProvider);

  useEffect(() => {
    if (provider !== "loading") return;

    let cancelled = false;
    void resolveMapboxToken()
      .then((token) => {
        if (!cancelled) setProvider(token ? "mapbox" : "google");
      })
      .catch(() => {
        if (!cancelled) setProvider("google");
      });

    return () => {
      cancelled = true;
    };
  }, [provider]);

  if (provider === "loading") {
    return <MapLoadingState message="Preparing 3D map…" />;
  }

  if (provider === "mapbox") {
    return <TenantMapboxView properties={properties} propertiesLoading={propertiesLoading} />;
  }

  return <TenantGoogleMapView properties={properties} propertiesLoading={propertiesLoading} />;
}

function TenantMapboxView({ properties, propertiesLoading }: TenantMapViewProps) {
  const map = useTenantMapbox(properties);
  return (
    <TenantMapShell
      map={map}
      propertiesLoading={propertiesLoading}
      onCycleStyle={map.cycleMapStyle}
      provider="mapbox"
    />
  );
}

function TenantGoogleMapView({ properties, propertiesLoading }: TenantMapViewProps) {
  const map = useTenantGoogleMap(properties);
  return <TenantMapShell map={map} propertiesLoading={propertiesLoading} provider="google" />;
}

function TenantMapShell({
  map,
  propertiesLoading,
  onCycleStyle,
  provider,
}: Readonly<{
  map: MapHookResult & { cycleMapStyle?: () => void };
  propertiesLoading: boolean;
  onCycleStyle?: () => void;
  provider: "mapbox" | "google";
}>) {
  const useFallback = Boolean(map.error);
  const loadingMessage = propertiesLoading ? "Loading listings…" : "Loading Nairobi map…";

  return (
    <div className="relative h-dvh min-h-screen overflow-hidden bg-(--color-obsidian)">
      {useFallback ? (
        <FallbackMap
          properties={map.filteredProperties}
          selected={map.selected}
          showHeat={map.showHeat}
          onSelect={map.setSelected}
        />
      ) : (
        <MapCanvas mapRef={map.mapRef} />
      )}

      {!map.ready && !map.error ? (
        <MapOverlay>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-(--color-graphite) px-4 py-2 text-sm text-white shadow-xl"
          >
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-[#1eb88a]" aria-hidden />
            <span>{loadingMessage}</span>
          </motion.div>
        </MapOverlay>
      ) : null}

      {onCycleStyle && map.ready && !map.error ? (
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
        error={map.error}
        filteredProperties={map.filteredProperties}
        panelOpen={map.panelOpen}
        onTogglePanel={() => map.setPanelOpen((v) => !v)}
        selected={map.selected}
        onSelect={map.setSelected}
        onClearSelected={() => map.setSelected(null)}
        mapProvider={provider}
      />
    </div>
  );
}

function MapCanvas({ mapRef }: Readonly<{ mapRef: React.RefObject<HTMLDivElement | null> }>) {
  return <div ref={mapRef} className="absolute inset-0 h-full min-h-0 w-full touch-none" />;
}

function MapOverlay({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-(--color-obsidian)/80 backdrop-blur-sm">
      {children}
    </div>
  );
}
