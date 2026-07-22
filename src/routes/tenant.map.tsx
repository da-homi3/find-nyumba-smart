import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead } from "@/lib/seo/head";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

/**
 * Map UI is kept alive by TenantLayout so returning to Map is instant.
 * Do not await listings here — a 150–300 pin pool was blocking TTFB (~3.5s).
 * Pins load client-side via TenantMapApp + bottom-nav intent warm.
 */
export const Route = createFileRoute("/tenant/map")({
  head: () =>
    buildPageHead({
      title: "Map — NyumbaSearch",
      description:
        "Map-first rental search across Nairobi. Clustered pins, rent heatmap, and neighbourhood filters for water, security, and more.",
      path: "/tenant/map",
    }),
  component: () => (
    <RouteErrorBoundary title="Map failed to load">
      {/* Visible map is rendered by TenantLayout keep-alive host. */}
      <div className="tenant-map-viewport bg-(--color-obsidian)" aria-hidden />
    </RouteErrorBoundary>
  ),
});
