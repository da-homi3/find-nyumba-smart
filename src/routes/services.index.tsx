import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { getProviderCategoryCounts } from "@/lib/api/service-provider.functions";

export const Route = createFileRoute("/services/")({
  head: () => ({ meta: [{ title: "Home services — NyumbaSearch" }] }),
  loader: async () => {
    const counts = await getProviderCategoryCounts();
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return { counts, total };
  },
  component: ServicesIndexPage,
});

function ServicesIndexPage() {
  const { counts, total } = Route.useLoaderData();

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">Everything your new home needs</h1>
        <p className="mt-2 text-muted-foreground">
          {total > 0
            ? `${total} trusted service providers across Nairobi and Kenya — browse by category below.`
            : "Trusted providers across Nairobi — electricians, movers, cleaners, and more."}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {SERVICE_CATEGORIES.map((c) => {
            const count = counts[c.id] ?? 0;
            return (
              <Link
                key={c.id}
                to="/services/$category"
                params={{ category: c.id }}
                className="group rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="text-2xl" aria-hidden>
                  {c.emoji}
                </span>
                <p className="mt-2 text-sm font-semibold group-hover:text-primary">{c.label}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {count > 0 ? `${count} provider${count === 1 ? "" : "s"}` : "View category →"}
                </p>
              </Link>
            );
          })}
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

        {total > 0 ? (
          <p className="mt-8 text-xs text-muted-foreground">
            Verified phone numbers are shown where confirmed from public sources. Others link to the
            business website — request a quote anytime and we&apos;ll help you connect.
          </p>
        ) : null}
      </main>
    </PublicPageShell>
  );
}
