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

const MAP_ARMED_KEY = "nyumba-map-armed";

export const Route = createFileRoute("/tenant")({
  component: TenantLayout,
});

function readMapArmed(): boolean {
  if (globalThis.sessionStorage === undefined) return false;
  try {
    return sessionStorage.getItem(MAP_ARMED_KEY) === "1";
  } catch {
    return false;
  }
}

function TenantLayout() {
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const isMessageThread = Boolean(matchRoute({ to: "/tenant/messages/$id", fuzzy: false }));
  const onMap = pathname.startsWith("/tenant/map");
  const [mapArmed, setMapArmed] = useState(readMapArmed);

  useEffect(() => {
    // Warm browse only — map's 500-listing fetch waits for Map tab intent.
    prefetchTenantSection(queryClient, "/tenant");
  }, [queryClient]);

  useEffect(() => {
    if (!onMap) return;
    setMapArmed(true);
    try {
      sessionStorage.setItem(MAP_ARMED_KEY, "1");
    } catch {
      // ignore
    }
  }, [onMap]);

  useEffect(() => {
    if (!onMap || !mapArmed) return;
    requestAnimationFrame(() => {
      globalThis.dispatchEvent(new Event("resize"));
    });
  }, [onMap, mapArmed]);

  return (
    <div className={cn("min-h-screen overflow-x-clip bg-background", !isMessageThread && "pb-24")}>
      {mapArmed ? (
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
