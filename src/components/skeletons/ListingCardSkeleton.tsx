import { skeletonKeys } from "@/components/skeletons/skeleton-keys";

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/6 bg-card">
      <div className="skeleton skeleton-image h-[220px] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-[22px] w-[110px] rounded-full" />
        <div className="skeleton skeleton-text wide" />
        <div className="skeleton skeleton-text medium" />
        <div className="skeleton h-7 w-36" />
        <div className="flex gap-3">
          <div className="skeleton h-[18px] w-16" />
          <div className="skeleton h-[18px] w-16" />
          <div className="skeleton h-[18px] w-[70px]" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-6 w-[70px] rounded-full" />
          <div className="skeleton h-6 w-[70px] rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 6 }: Readonly<{ count?: number }>) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skeletonKeys(count).map((id) => (
        <ListingCardSkeleton key={id} />
      ))}
    </div>
  );
}
