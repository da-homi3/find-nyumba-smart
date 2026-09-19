import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { ServiceCategoryIcon } from "@/components/services/ServiceCategoryIcon";
import { ScrollReveal } from "@/components/motion/ScrollReveal";

const TEASER_CATEGORIES = SERVICE_CATEGORIES.slice(0, 8);

const IsometricHouse3D = lazy(() =>
  import("@/components/landing/IsometricHouse3D").then((m) => ({ default: m.IsometricHouse3D })),
);

function HousePlaceholder() {
  return (
    <div
      className="relative mx-auto flex h-64 w-full max-w-sm items-end justify-center overflow-hidden rounded-3xl border border-border bg-linear-to-br from-emerald-950 via-background to-secondary sm:h-72"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.35),transparent_55%)]" />
      <div className="relative mb-8 flex flex-col items-center">
        <svg width="88" height="96" viewBox="0 0 88 96" className="text-emerald-500" aria-hidden>
          <polygon points="44,4 84,40 4,40" fill="currentColor" />
          <rect x="14" y="40" width="60" height="48" rx="2" className="fill-emerald-900" />
          <rect x="36" y="58" width="16" height="30" className="fill-amber-300/90" />
        </svg>
        <div className="mt-2 h-2 w-36 rounded-full bg-foreground/15" />
      </div>
    </div>
  );
}

export function ServicesWithHouseSection({
  counts,
}: Readonly<{ counts?: Record<string, number> }>) {
  return (
    <section className="border-t bg-secondary/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
        <ScrollReveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Services
              </p>
              <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
                Everything you need
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                From movers to plumbers — book trusted home services alongside your search.
              </p>
            </div>
            <Link
              to="/services"
              className="hidden shrink-0 text-sm font-semibold text-primary hover:underline sm:inline"
            >
              View all →
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TEASER_CATEGORIES.map((c) => {
              const count = counts?.[c.id];
              return (
                <Link
                  key={c.id}
                  to="/services/$category"
                  params={{ category: c.id }}
                  className="group flex flex-col items-center rounded-2xl border bg-card p-4 text-center text-xs font-semibold transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ServiceCategoryIcon categoryId={c.id} size="sm" />
                  <p className="mt-2 group-hover:text-primary">{c.label}</p>
                  {count != null && count > 0 ? (
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                      {count} provider{count === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              to="/services"
              className="text-sm font-semibold text-primary hover:underline sm:hidden"
            >
              View all services →
            </Link>
            <Link
              to="/services/register"
              className="inline-flex text-sm font-semibold text-primary hover:underline"
            >
              Join as a service provider →
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal className="hidden sm:block">
          <Suspense fallback={<HousePlaceholder />}>
            <IsometricHouse3D />
          </Suspense>
        </ScrollReveal>
      </div>
    </section>
  );
}
