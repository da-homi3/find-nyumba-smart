import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PropertyCard } from "@/components/PropertyCard";
import { PublicPageShell } from "@/components/SiteNav";
import { EmptyState } from "@/components/EmptyState";
import { fetchProperties } from "@/lib/properties";
import {
  homepageCategoryById,
  HOMEPAGE_PROPERTY_CATEGORIES,
} from "@/lib/landing/homepage-categories";
import { buildPageHead } from "@/lib/seo/head";
import { getSiteUrl } from "@/lib/site";

export const Route = createFileRoute("/categories/$id")({
  loader: async ({ params }) => {
    const category = homepageCategoryById(params.id);
    if (!category) throw notFound();
    const listings = await fetchProperties({
      propertyType: category.search.type,
      pricingMode: category.search.purpose,
      sortBy: "newest",
      limit: 24,
    });
    return { category, listings };
  },
  head: ({ loaderData, params }) => {
    const category = loaderData?.category ?? homepageCategoryById(params.id);
    if (!category) {
      return buildPageHead({
        title: "Property categories — NyumbaSearch",
        description: "Browse homes by type across Nairobi on NyumbaSearch.",
        path: "/categories",
        noIndex: true,
      });
    }
    const count = loaderData?.listings?.length ?? 0;
    const title = `${category.label} for rent in Nairobi — NyumbaSearch`;
    const description = `${category.description}. Browse ${count || "verified"} ${category.label.toLowerCase()} listings with maps, owner contact, and trust signals on NyumbaSearch.`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: getSiteUrl() },
            {
              "@type": "ListItem",
              position: 2,
              name: "Categories",
              item: `${getSiteUrl()}/categories`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: category.label,
              item: `${getSiteUrl()}/categories/${category.id}`,
            },
          ],
        },
        ...(loaderData?.listings?.length
          ? [
              {
                "@type": "ItemList",
                name: `${category.label} in Nairobi`,
                numberOfItems: loaderData.listings.length,
                itemListElement: loaderData.listings.slice(0, 20).map((p, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  url: `${getSiteUrl()}/tenant/property/${p.id}`,
                  name: p.title,
                })),
              },
            ]
          : []),
      ],
    };
    return {
      ...buildPageHead({
        title,
        description,
        path: `/categories/${category.id}`,
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category, listings } = Route.useLoaderData();
  const search: Record<string, string> = {};
  if (category.search.type) search.type = category.search.type;
  if (category.search.purpose) search.purpose = category.search.purpose;

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span aria-hidden> · </span>
          <Link to="/categories" className="hover:text-foreground">
            Categories
          </Link>
          <span aria-hidden> · </span>
          <span className="text-foreground">{category.label}</span>
        </nav>

        <h1 className="mt-4 font-display text-3xl font-semibold">{category.label} in Nairobi</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{category.description}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/tenant"
            search={search}
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Open full search
          </Link>
          <Link
            to="/tenant/map"
            search={search}
            className="inline-flex min-h-11 items-center rounded-xl border px-5 py-2.5 text-sm font-semibold"
          >
            Map view
          </Link>
        </div>

        {listings.length === 0 ? (
          <EmptyState type="no_search_results" className="mt-10" />
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((p, index) => (
              <PropertyCard key={p.id} p={p} priority={index < 2} />
            ))}
          </div>
        )}

        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            More categories
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {HOMEPAGE_PROPERTY_CATEGORIES.filter((c) => c.id !== category.id).map((c) => (
              <Link
                key={c.id}
                to="/categories/$id"
                params={{ id: c.id }}
                className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
