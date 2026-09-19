import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PropertyCard } from "@/components/PropertyCard";
import { PublicPageShell } from "@/components/SiteNav";
import { EmptyState } from "@/components/EmptyState";
import { getPublicPartnerProfile } from "@/lib/api/pilot-partnership.functions";
import { buildPageHead } from "@/lib/seo/head";
import type { Property } from "@/lib/properties";

export const Route = createFileRoute("/partners/$slug")({
  loader: async ({ params }) => {
    const profile = await getPublicPartnerProfile({ data: { slug: params.slug } });
    if (!profile) throw notFound();
    return { profile };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.profile?.pilot.partnerName ?? "Partner";
    return buildPageHead({
      title: `${name} — NyumbaSearch Official Partner`,
      description: `Browse properties from ${name} on NyumbaSearch.`,
      path: `/partners/${params.slug}`,
    });
  },
  component: PartnerProfilePage,
});

function PartnerProfilePage() {
  const { profile } = Route.useLoaderData();
  const org = profile.organization as {
    name?: string;
    description?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
    office_location?: string | null;
    logo_url?: string | null;
  } | null;
  const listings = (profile.properties ?? []) as Property[];
  const pending = Boolean(profile.pending);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Official Partner
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{profile.pilot.partnerName}</h1>
        {org?.description ? (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{org.description}</p>
        ) : (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {pending
              ? "This partner has been invited to the NyumbaSearch pilot. Live listings will appear here once they join and publish properties."
              : "Portfolio partner on NyumbaSearch. Browse live properties from this partner below."}
          </p>
        )}

        {pending ? (
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            Pilot onboarding in progress. Check back soon, or{" "}
            <Link to="/tenant" className="font-semibold text-primary underline">
              browse all homes
            </Link>{" "}
            on NyumbaSearch.
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {org?.office_location ? <span>{org.office_location}</span> : null}
          {org?.website ? (
            <a
              href={org.website}
              className="text-primary underline"
              rel="noreferrer"
              target="_blank"
            >
              Website
            </a>
          ) : null}
          {org?.email ? <a href={`mailto:${org.email}`}>{org.email}</a> : null}
          {org?.phone ? <a href={`tel:${org.phone}`}>{org.phone}</a> : null}
        </div>

        <h2 className="mt-10 font-display text-xl font-semibold">Properties</h2>
        {listings.length === 0 ? (
          <EmptyState type="no_listings" href="/tenant" cta="Browse all homes" />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((p) => (
              <PropertyCard
                key={p.id}
                p={p}
                partnerBadge={{ name: profile.pilot.partnerName, slug: profile.pilot.publicSlug! }}
              />
            ))}
          </div>
        )}

        <p className="mt-8 text-sm text-muted-foreground">
          <Link to="/tenant" className="text-primary underline">
            Browse all homes
          </Link>
        </p>
      </main>
    </PublicPageShell>
  );
}
