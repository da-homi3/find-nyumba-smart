import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";

export const Route = createFileRoute("/services")({
  head: () => ({ meta: [{ title: "Home services — NyumbaSearch" }] }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">Everything your new home needs</h1>
        <p className="mt-2 text-muted-foreground">
          Trusted providers across Nairobi — in one place.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {SERVICE_CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to="/services/$category"
              params={{ category: c.id }}
              className="rounded-2xl border bg-card p-5 shadow-soft hover:border-primary/30"
            >
              <span className="text-2xl">{c.emoji}</span>
              <p className="mt-2 text-sm font-semibold">{c.label}</p>
            </Link>
          ))}
        </div>
        <Link
          to="/services/register"
          className="mt-10 inline-block text-sm font-semibold text-primary"
        >
          Join as a service provider →
        </Link>
      </main>
    </PublicPageShell>
  );
}
