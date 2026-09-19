import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PropertyCard } from "@/components/PropertyCard";
import { PublicPageShell } from "@/components/SiteNav";
import { fetchProperties, formatKes, type Property } from "@/lib/properties";
import { resolveAreaFromSlug, GEO_AREAS } from "@/lib/seo/areas";
import { buildPageHead } from "@/lib/seo/head";
import { getSiteUrl } from "@/lib/site";
import { NYUMBASEARCH_FAQS } from "@/lib/seo/faq";

export const Route = createFileRoute("/guides/$slug")({
  loader: async ({ params }) => {
    const area = await resolveAreaFromSlug(params.slug);
    if (!area) throw notFound();
    const listings = await fetchProperties({
      neighborhood: area.name,
      locationId: area.locationId,
      sortBy: "newest",
      limit: 12,
    });
    return { area, listings };
  },
  head: ({ loaderData, params }) => {
    const area = loaderData?.area;
    if (!area) {
      return buildPageHead({
        title: "Renting guides — NyumbaSearch",
        description: "Neighbourhood guides for renting in Nairobi.",
        path: "/guides",
        noIndex: true,
      });
    }
    const region = area.countyName?.replace(/\s+City$/i, "") ?? "Nairobi";
    const from = loaderData?.listings
      ?.map((p) => p.rent_kes)
      .filter((n) => n > 0)
      .sort((a, b) => a - b)[0];
    const priceBit = from ? ` Typical listings from ${formatKes(from)}/month.` : "";
    const title = `Renting in ${area.name}, ${region}: guide — NyumbaSearch`;
    const description = `How to rent in ${area.name} without agent fees.${priceBit} Tips, FAQs, and live verified homes on NyumbaSearch.`;
    const faqs = [
      {
        question: `Is it free to search homes in ${area.name}?`,
        answer: `Yes. Browse listings for ${area.name} free on NyumbaSearch. Unlocking a landlord phone uses a contact credit or a one-time M-Pesa fee.`,
      },
      {
        question: `How do I avoid rental scams in ${area.name}?`,
        answer:
          "Use verified listings, book a viewing before paying a deposit, and never send money to personal mobile numbers that are not shown after unlock on NyumbaSearch.",
      },
      ...NYUMBASEARCH_FAQS.slice(0, 2),
    ];
    return {
      ...buildPageHead({
        title,
        description,
        path: `/guides/${params.slug}`,
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: getSiteUrl() },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Guides",
                    item: `${getSiteUrl()}/guides`,
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: area.name,
                    item: `${getSiteUrl()}/guides/${area.slug}`,
                  },
                ],
              },
              {
                "@type": "FAQPage",
                mainEntity: faqs.map((f) => ({
                  "@type": "Question",
                  name: f.question,
                  acceptedAnswer: { "@type": "Answer", text: f.answer },
                })),
              },
            ],
          }),
        },
      ],
    };
  },
  component: RentGuidePage,
});

function RentGuidePage() {
  const { area, listings } = Route.useLoaderData();
  const region = area.countyName?.replace(/\s+City$/i, "") ?? "Nairobi";
  const from = listings
    .map((p: Property) => p.rent_kes)
    .filter((n: number) => n > 0)
    .sort((a: number, b: number) => a - b)[0];

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span aria-hidden> · </span>
          <Link to="/guides" className="hover:text-foreground">
            Guides
          </Link>
          <span aria-hidden> · </span>
          <span className="text-foreground">{area.name}</span>
        </nav>

        <h1 className="mt-4 font-display text-3xl font-semibold">
          Renting in {area.name}, {region}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A short guide to finding a verified home in {area.name} on NyumbaSearch — map search,
          direct landlord contact, and no broker viewing fees.
          {from ? ` Live listings currently start around ${formatKes(from)}/month.` : ""}
        </p>

        <section className="mt-8 space-y-4">
          <h2 className="font-display text-xl font-semibold">What to do first</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Browse current homes in {area.name} and save shortlists.</li>
            <li>Book a viewing before paying any deposit.</li>
            <li>Unlock contact only when you are ready to message the lister.</li>
            <li>Apply with your Tenant Profile so landlords can review you quickly.</li>
          </ol>
        </section>

        <section className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/areas/$slug"
            params={{ slug: area.slug }}
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            See homes in {area.name}
          </Link>
          <Link
            to="/tenant/map"
            search={{ neighborhood: area.name }}
            className="inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-semibold"
          >
            Open map
          </Link>
        </section>

        {listings.length > 0 ? (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Featured in {area.name}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {listings.slice(0, 4).map((p: Property) => (
                <PropertyCard key={p.id} p={p} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            More neighbourhood guides
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {GEO_AREAS.filter((a) => a.slug !== area.slug)
              .slice(0, 8)
              .map((a) => (
                <Link
                  key={a.slug}
                  to="/guides/$slug"
                  params={{ slug: a.slug }}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
                >
                  {a.name}
                </Link>
              ))}
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
