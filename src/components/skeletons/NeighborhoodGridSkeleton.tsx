import { FILTER_CHIP_WIDTHS, skeletonKeys } from "@/components/skeletons/skeleton-keys";

export function NeighborhoodGridSkeleton({ count = 8 }: Readonly<{ count?: number }>) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {skeletonKeys(count).map((id) => (
        <div key={id} className="aspect-3/4 overflow-hidden rounded-2xl">
          <div className="skeleton h-full w-full" />
        </div>
      ))}
    </div>
  );
}

export function FilterChipsSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {FILTER_CHIP_WIDTHS.map(({ id, width }) => (
        <div key={id} className="skeleton h-9 shrink-0 rounded-full" style={{ width }} />
      ))}
    </div>
  );
}
