import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { HOMEPAGE_PROPERTY_CATEGORIES } from "@/lib/landing/homepage-categories";
import { buildPageHead } from "@/lib/seo/head";

export const Route = createFileRoute("/categories/")({
  head: () =>
    buildPageHead({
      title: "Property categories in Nairobi — NyumbaSearch",
      description:
        "Browse bedsitters, apartments, maisonettes, Airbnbs, and more verified homes by category on NyumbaSearch.",
      path: "/categories",
    }),
  component: CategoriesIndex,
});

function CategoriesIndex() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">Property categories</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Start with the home type you need, then refine by neighbourhood, budget, and map.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HOMEPAGE_PROPERTY_CATEGORIES.map((category) => (
            <li key={category.id}>
              <Link
                to="/categories/$id"
                params={{ id: category.id }}
                className="block rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/35"
              >
                <p className="font-semibold text-foreground">{category.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </PublicPageShell>
  );
}
