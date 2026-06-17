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
          Trusted providers across Nairobi — electricians, movers, cleaners, and more.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {SERVICE_CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to="/services/$category"
              params={{ category: c.id }}
              className="rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/30"
            >
              <span className="text-2xl">{c.emoji}</span>
              <p className="mt-2 text-sm font-semibold">{c.label}</p>
            </Link>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border bg-secondary/40 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">Are you a service provider?</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            List your business on NyumbaSearch and reach tenants who just found a home. First month
            free for new subscribers — get listed in minutes.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/services/register"
              className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Join as a service provider
            </Link>
            <Link
              to="/services/provider/dashboard"
              className="inline-flex rounded-xl border px-5 py-2.5 text-sm font-semibold"
            >
              Provider dashboard
            </Link>
          </div>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Sample provider listings are shown in categories until verified businesses go live.
          Request a quote anytime — we&apos;ll connect you with a vetted pro.
        </p>
      </main>
    </PublicPageShell>
  );
}
