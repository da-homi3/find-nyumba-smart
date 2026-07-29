import { createFileRoute, Outlet, useMatchRoute, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { prefetchTenantSection } from "@/lib/tenant-section-prefetch";
import { cn } from "@/lib/utils";

const TenantMapApp = lazy(() =>
  import("@/components/tenant-map/TenantMapApp").then((m) => ({ default: m.TenantMapApp })),
);
const AiAssistant = lazy(() =>
  import("@/components/AiAssistant").then((m) => ({ default: m.AiAssistant })),
);

/** Keep Mapbox mounted briefly when leaving the map tab, then unmount to free WebGL. */
const MAP_KEEPALIVE_MS = 45_000;

export const Route = createFileRoute("/tenant")({
  component: TenantLayout,
});

function TenantLayout() {
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const isMessageThread = Boolean(matchRoute({ to: "/tenant/messages/$id", fuzzy: false }));
  const onMap = pathname.startsWith("/tenant/map");
  const [mapMounted, setMapMounted] = useState(onMap);

  useEffect(() => {
    // Warm browse only — map's listing fetch waits for Map tab intent.
    prefetchTenantSection(queryClient, "/tenant");
  }, [queryClient]);

  useEffect(() => {
    if (onMap) {
      setMapMounted(true);
      return;
    }
    if (!mapMounted) return;
    const timer = globalThis.setTimeout(() => setMapMounted(false), MAP_KEEPALIVE_MS);
    return () => globalThis.clearTimeout(timer);
  }, [onMap, mapMounted]);

  useEffect(() => {
    if (!onMap || !mapMounted) return;
    requestAnimationFrame(() => {
      globalThis.dispatchEvent(new Event("resize"));
    });
  }, [onMap, mapMounted]);

  return (
    <div className={cn("min-h-screen overflow-x-clip bg-background", !isMessageThread && "pb-24")}>
      {mapMounted ? (
        <div
          className={cn(
            "fixed inset-0 z-1",
            onMap ? "visible pointer-events-auto" : "invisible pointer-events-none",
          )}
          aria-hidden={!onMap}
        >
          <Suspense fallback={null}>
            <TenantMapApp />
          </Suspense>
        </div>
      ) : null}

      <div className={cn(onMap && "invisible h-0 overflow-hidden")}>
        <Outlet />
      </div>

      {!isMessageThread && !onMap ? (
        <Suspense fallback={null}>
          <AiAssistant />
        </Suspense>
      ) : null}
    </div>
  );
}
