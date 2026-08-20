import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { loadIndexableAreas, shouldIndexArea } from "@/lib/seo/areas";
import { buildPageHead } from "@/lib/seo/head";
import { getSiteUrl } from "@/lib/site";
import { NAIROBI_GEO } from "@/lib/seo/faq";

export const Route = createFileRoute("/areas/")({
  loader: async () => {
    const areas = (await loadIndexableAreas()).filter(shouldIndexArea);
    return { areas };
  },
  head: ({ loaderData }) => {
    const areas = loaderData?.areas ?? [];
    return buildPageHead({
      title: "Neighbourhoods for rent in Kenya — NyumbaSearch",
      description:
        "Browse verified homes for rent by neighbourhood: Kilimani, Westlands, Karen, Lavington, South B, and more. Map search and owner listings.",
      path: "/areas",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Neighbourhoods for rent in Kenya",
        description: "Verified rental listings grouped by neighbourhood with live inventory.",
        url: `${getSiteUrl()}/areas`,
        about: {
          "@type": "City",
          name: "Nairobi",
          geo: {
            "@type": "GeoCoordinates",
            latitude: NAIROBI_GEO.latitude,
            longitude: NAIROBI_GEO.longitude,
          },
        },
        hasPart: areas.map((area) => ({
          "@type": "WebPage",
          name: `Homes for rent in ${area.name}`,
          url: `${getSiteUrl()}/areas/${area.slug}`,
        })),
      },
    });
  },
  component: AreasIndexPage,
});

function AreasIndexPage() {
  const { areas } = Route.useLoaderData();

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Kenya</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          Homes for rent by neighbourhood
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground leading-relaxed">
          Browse verified vacant houses and apartments. Area pages are listed only where NyumbaSearch
          has live inventory — including stable Nairobi neighbourhood URLs.
        </p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {areas.map((area) => (
            <li key={area.slug}>
              <Link
                to="/areas/$slug"
                params={{ slug: area.slug }}
                className="block rounded-2xl border bg-card px-4 py-4 text-sm font-semibold hover:border-primary/40 hover:text-primary"
              >
                {area.name}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {area.countyName?.replace(/\s+City$/i, "") ?? "Kenya"}
                  {area.inventoryCount != null && area.inventoryCount > 0
                    ? ` · ${area.inventoryCount} listings`
                    : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm">
          <Link to="/tenant" className="font-semibold text-primary">
            Search all homes →
          </Link>
        </p>
      </main>
    </PublicPageShell>
  );
}
