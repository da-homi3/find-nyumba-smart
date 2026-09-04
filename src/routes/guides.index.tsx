import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { GEO_AREAS } from "@/lib/seo/areas";
import { buildPageHead } from "@/lib/seo/head";

export const Route = createFileRoute("/guides/")({
  head: () =>
    buildPageHead({
      title: "Nairobi renting guides — NyumbaSearch",
      description:
        "Neighbourhood guides for renting in Nairobi: tips, FAQs, and live verified homes by area.",
      path: "/guides",
    }),
  component: GuidesIndex,
});

function GuidesIndex() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">Nairobi renting guides</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Practical answers for finding a home without agent fees — pick a neighbourhood to start.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {GEO_AREAS.map((area) => (
            <li key={area.slug}>
              <Link
                to="/guides/$slug"
                params={{ slug: area.slug }}
                className="block rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/35"
              >
                <p className="font-semibold">Renting in {area.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">Guide + live listings</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </PublicPageShell>
  );
}
