import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PropertyCard } from "@/components/PropertyCard";
import { PublicPageShell } from "@/components/SiteNav";
import { EmptyState } from "@/components/EmptyState";
import { fetchProperties, formatKes } from "@/lib/properties";
import { resolveAreaFromSlug, shouldIndexArea } from "@/lib/seo/areas";
import { buildPageHead } from "@/lib/seo/head";
import { neighborhoodCentroid } from "@/lib/geo/property-map-coords";
import { getSiteUrl } from "@/lib/site";
import { NAIROBI_GEO } from "@/lib/seo/faq";

export const Route = createFileRoute("/areas/$slug")({
  loader: async ({ params }) => {
    const area = await resolveAreaFromSlug(params.slug);
    if (!area) throw notFound();
    const listings = await fetchProperties({
      neighborhood: area.name,
      locationId: area.locationId,
      sortBy: "newest",
      limit: 24,
    });
    return { area, listings };
  },
  head: ({ loaderData }) => {
    const area = loaderData?.area;
    if (!area) {
      return buildPageHead({
        title: "Neighbourhood — NyumbaSearch",
        description: "Browse verified homes for rent across Nairobi on NyumbaSearch.",
        path: "/areas",
        noIndex: true,
      });
    }
    const region = area.countyName?.replace(/\s+City$/i, "") ?? "Nairobi";
    const geo = neighborhoodCentroid(area.name);
    const count = loaderData?.listings?.length ?? 0;
    const from = loaderData?.listings
      ?.map((p) => p.rent_kes)
      .filter((n) => n > 0)
      .sort((a, b) => a - b)[0];
    const priceBit = from ? ` from ${formatKes(from)}/month` : "";
    const title = `Homes for rent in ${area.name}, ${region} — NyumbaSearch`;
    const description = `Find verified vacant houses and apartments in ${area.name}, ${region}${priceBit}. Map search, owner listings, and ${count || "live"} homes on NyumbaSearch.`;
    const itemList =
      loaderData?.listings && loaderData.listings.length > 0
        ? {
            "@type": "ItemList",
            name: `Rentals in ${area.name}, ${region}`,
            numberOfItems: loaderData.listings.length,
            itemListElement: loaderData.listings.slice(0, 20).map((p, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${getSiteUrl()}/tenant/property/${p.id}`,
              name: p.title,
            })),
          }
        : null;
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Place",
          name: `${area.name}, ${region}`,
          address: {
            "@type": "PostalAddress",
            addressLocality: area.name,
            addressRegion: region,
            addressCountry: "KE",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: geo?.lat ?? NAIROBI_GEO.latitude,
            longitude: geo?.lng ?? NAIROBI_GEO.longitude,
          },
          containedInPlace: { "@type": "City", name: region },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: getSiteUrl() },
            { "@type": "ListItem", position: 2, name: "Areas", item: `${getSiteUrl()}/areas` },
            {
              "@type": "ListItem",
              position: 3,
              name: area.name,
              item: `${getSiteUrl()}/areas/${area.slug}`,
            },
          ],
        },
        ...(itemList ? [itemList] : []),
      ],
    };
    return buildPageHead({
      title,
      description,
      path: `/areas/${area.slug}`,
      latitude: geo?.lat ?? NAIROBI_GEO.latitude,
      longitude: geo?.lng ?? NAIROBI_GEO.longitude,
      placename: `${area.name}, ${region}, Kenya`,
      jsonLd,
      noIndex: !shouldIndexArea(area),
    });
  },
  component: AreaPage,
});

function AreaPage() {
  const { area, listings } = Route.useLoaderData();
  const region = area.countyName?.replace(/\s+City$/i, "") ?? "Nairobi";

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {region} · Kenya
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          Homes for rent in {area.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground leading-relaxed">
          Verified vacant listings in {area.name}, {region}. Filter on the map, compare rent in KES,
          and contact property owners on NyumbaSearch.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/areas" className="text-muted-foreground">
            All areas
          </Link>
          <Link to="/tenant/map" className="font-semibold text-primary">
            Open map →
          </Link>
          <Link to="/tenant" search={{ neighborhood: area.name }} className="text-muted-foreground">
            All filters
          </Link>
        </div>
        {listings.length === 0 ? (
          <EmptyState type="no_search_results" href="/tenant" cta="Browse all homes" />
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((p) => (
              <PropertyCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </main>
    </PublicPageShell>
  );
}
