import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  Building,
  Building2,
  GraduationCap,
  Home,
  Hotel,
  LayoutGrid,
  MoonStar,
  Rows3,
} from "lucide-react";
import {
  HOMEPAGE_PROPERTY_CATEGORIES,
  type HomepageCategory,
} from "@/lib/landing/homepage-categories";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  bedsitter: BedDouble,
  one_bedroom: BedDouble,
  two_bedroom: BedDouble,
  three_bedroom: BedDouble,
  four_plus: LayoutGrid,
  maisonette: Building2,
  townhouse: Rows3,
  penthouse: Building,
  house: Home,
  airbnb: Hotel,
  short_let: MoonStar,
};

function CategoryIcon({ categoryId }: Readonly<{ categoryId: string }>) {
  const Icon = CATEGORY_ICONS[categoryId] ?? LayoutGrid;
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

function CategoryCard({
  category,
  count,
}: Readonly<{ category: HomepageCategory; count?: number }>) {
  return (
    <Link
      to="/categories/$id"
      params={{ id: category.id }}
      className={cn(
        "group flex min-w-38 shrink-0 snap-start flex-col rounded-2xl border bg-card p-4",
        "shadow-soft transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "sm:min-w-0",
      )}
    >
      <CategoryIcon categoryId={category.id} />
      <p className="mt-3 font-display text-sm font-semibold leading-snug group-hover:text-primary">
        {category.label}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {category.description}
      </p>
      {count != null && count > 0 ? (
        <p className="mt-2 text-[10px] font-medium text-muted-foreground">
          {`${count} listing${count === 1 ? "" : "s"} now`}
        </p>
      ) : null}
    </Link>
  );
}

export function PropertyCategoryGrid({
  counts,
  loading = false,
}: Readonly<{ counts?: Record<string, number>; loading?: boolean }>) {
  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16" aria-busy="true">
        <div className="skeleton h-8 w-56" />
        <div className="mt-6 flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-36 min-w-38 shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16"
      aria-label="Property categories"
    >
      <ScrollReveal className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Browse by type
          </p>
          <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
            Property categories
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Jump straight to bedsitters, family homes, Airbnbs, and more across Nairobi.
          </p>
        </div>
        <Link
          to="/tenant"
          className="hidden shrink-0 text-sm font-semibold text-primary hover:underline sm:inline"
        >
          View all →
        </Link>
      </ScrollReveal>

      <div className="-mx-5 mt-6 flex gap-3 overflow-x-auto px-5 pb-1 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 xl:grid-cols-6">
        {HOMEPAGE_PROPERTY_CATEGORIES.map((category) => (
          <CategoryCard key={category.id} category={category} count={counts?.[category.id]} />
        ))}
      </div>

      <Link to="/tenant" className="mt-5 inline-flex text-sm font-semibold text-primary sm:hidden">
        View all categories →
      </Link>
    </section>
  );
}
