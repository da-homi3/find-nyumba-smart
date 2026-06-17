import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { fetchProperties, type Property } from "@/lib/properties";
import { FallbackMap } from "@/components/tenant-map/FallbackMap";
import { TenantMapChrome } from "@/components/tenant-map/TenantMapChrome";
import { LazyRadar } from "@/components/LazyRadar";
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
    <div className="relative h-dvh min-h-screen bg-[#0c1a12]">
      <LazyRadar
        speed={0.7}
        scale={1.2}
        ringCount={12}
        spokeCount={14}
        ringThickness={0.04}
        spokeThickness={0.01}
        sweepSpeed={0.8}
        sweepWidth={3}
        sweepLobes={1}
        color="#1eb88a"
        backgroundColor="#0c1a12"
        falloff={2.2}
        brightness={1}
        enableMouseInteraction
        mouseInfluence={0.12}
      />
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-base text-white/70"
        >
          {message}
        </motion.span>
      </div>
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
    return <MapLoadingState message="Scanning Nairobi for verified homes near you…" />;
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
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: map.ready || map.error ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      >
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
      </motion.div>

      {!map.ready && !map.error ? (
        <MapOverlay>
          <div className="relative h-48 w-full max-w-md overflow-hidden rounded-2xl">
            <LazyRadar
              speed={0.7}
              scale={1}
              ringCount={10}
              spokeCount={12}
              ringThickness={0.04}
              spokeThickness={0.01}
              sweepSpeed={0.9}
              sweepWidth={3}
              sweepLobes={1}
              color="#1eb88a"
              backgroundColor="#0c1a12"
              falloff={2.2}
              brightness={1}
              enableMouseInteraction={false}
              mouseInfluence={0}
            />
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
              <span className="text-center text-sm text-white/75">{loadingMessage}</span>
            </div>
          </div>
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
