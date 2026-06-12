import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProperties } from "@/lib/properties";
import { FallbackMap } from "@/components/tenant-map/FallbackMap";
import { TenantMapChrome } from "@/components/tenant-map/TenantMapChrome";
import { useTenantGoogleMap } from "@/hooks/use-tenant-google-map";

export const Route = createFileRoute("/tenant/map")({
  head: () => ({ meta: [{ title: "Map — NyumbaSearch" }] }),
  component: TenantMap,
});

function TenantMap() {
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: () => fetchProperties(),
  });

  const map = useTenantGoogleMap(properties);

  return (
    <div className="relative min-h-[calc(100vh-5.5rem)] h-[calc(100vh-5.5rem)] overflow-hidden bg-secondary">
      {map.error ? (
        <FallbackMap
          properties={map.filteredProperties}
          selected={map.selected}
          showHeat={map.showHeat}
          onSelect={map.setSelected}
        />
      ) : (
        <div ref={map.mapRef} className="absolute inset-0" />
      )}

      {!map.ready && !map.error && (
        <div className="absolute inset-0 grid place-items-center bg-secondary/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm shadow-card">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            {propertiesLoading ? "Loading listings…" : "Loading Nairobi map…"}
          </div>
        </div>
      )}

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
      />
    </div>
  );
}
