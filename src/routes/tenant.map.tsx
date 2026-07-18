import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead } from "@/lib/seo/head";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { fetchListingsApi } from "@/lib/listings-client";
import { listingsQueryKey } from "@/hooks/use-listings-search";
import { MAP_LISTINGS_FILTERS } from "@/lib/tenant-section-prefetch";

/**
 * Map UI is kept alive by TenantLayout so returning to Map is instant.
 * This route only handles SEO head + data prefetch; the layout renders TenantMapApp.
 */
export const Route = createFileRoute("/tenant/map")({
  head: () =>
    buildPageHead({
      title: "Map — NyumbaSearch",
      description:
        "Map-first rental search across Nairobi. Clustered pins, rent heatmap, and neighbourhood filters for water, security, and more.",
      path: "/tenant/map",
    }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: listingsQueryKey(MAP_LISTINGS_FILTERS),
      queryFn: () => fetchListingsApi(MAP_LISTINGS_FILTERS),
    });
  },
  component: () => (
    <RouteErrorBoundary title="Map failed to load">
      {/* Visible map is rendered by TenantLayout keep-alive host. */}
      <div className="tenant-map-viewport bg-(--color-obsidian)" aria-hidden />
    </RouteErrorBoundary>
  ),
});
