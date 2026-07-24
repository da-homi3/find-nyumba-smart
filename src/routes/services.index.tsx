import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { ServiceCategoryIcon } from "@/components/services/ServiceCategoryIcon";
import { getProviderCategoryCounts } from "@/lib/api/service-provider.functions";
import { buildPageHead } from "@/lib/seo/head";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";
import servicesHero from "@/assets/services-hero-premium.webp";

export const Route = createFileRoute("/services/")({
  head: () =>
    buildPageHead({
      title: "Home services — NyumbaSearch",
      description:
        "Find verified electricians, plumbers, movers, cleaners, and 21 more home service categories across 14 Kenyan counties.",
      path: "/services",
    }),
  loader: async () => {
    const counts = await getProviderCategoryCounts();
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return { counts, total };
  },
  component: ServicesIndexPage,
});

function providerCountLabel(count: number): string {
  if (count <= 0) return "View category →";
  const suffix = count === 1 ? "" : "s";
  return `${count} provider${suffix}`;
}

function ServicesIndexPage() {
  const { counts, total } = Route.useLoaderData();

  return (
    <PublicPageShell>
      <section className="relative isolate overflow-hidden border-b border-border/60">
        <div className="absolute inset-0">
          <img
            src={servicesHero}
            alt=""
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-linear-to-r from-background via-background/85 to-background/40" />
          <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-background/30" />
        </div>
        <div className="relative mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <p className="text-caption font-semibold uppercase tracking-[0.14em] text-primary">
            Verified home services
          </p>
          <h1 className="text-headline mt-3 max-w-2xl text-foreground">
            Everything your new home needs
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            {total > 0
              ? `${total} trusted service providers across Kenya — browse by category and filter by county.`
              : "Trusted providers across Nairobi — electricians, movers, cleaners, and more."}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <div
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
          data-tour="services-categories"
        >
          {SERVICE_CATEGORIES.map((c) => {
            const count = counts[c.id] ?? 0;
            return (
              <Link
                key={c.id}
                to="/services/$category"
                params={{ category: c.id }}
                className="group glass-card rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ServiceCategoryIcon categoryId={c.id} size="md" className="mx-auto" />
                <p className="mt-2 text-sm font-semibold group-hover:text-primary">{c.label}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {providerCountLabel(count)}
                </p>
              </Link>
            );
          })}
        </div>

        <section
          className="glass-card mt-12 rounded-2xl p-6 sm:p-8"
          data-tour="services-register"
        >
          <h2 className="font-display text-xl font-semibold">Are you a service provider?</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            List your business on NyumbaSearch and reach tenants who just found a home. First month
            free for new subscribers — get listed in minutes.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/services/register"
              className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_6px_18px_-6px_rgba(10,143,61,0.5)] transition active:scale-[0.97]"
            >
              Join as a service provider
            </Link>
            <Link
              to="/services/provider/dashboard"
              className="inline-flex rounded-xl border border-border bg-background/70 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-secondary"
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
      <OnboardingTourHost tourId="services-directory" />
    </PublicPageShell>
  );
}
