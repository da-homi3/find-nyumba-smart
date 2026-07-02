import { DETAIL_INTEL_KEYS, DETAIL_LINE_KEYS } from "@/components/skeletons/skeleton-keys";

export function PropertyDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="skeleton h-[55vh] rounded-b-[20px]" />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="skeleton h-[26px] w-32 rounded-full" />
        <div className="skeleton h-8 w-3/4" />
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-11 w-48" />
        <div className="skeleton h-36 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {DETAIL_INTEL_KEYS.map((id) => (
            <div key={id} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        {DETAIL_LINE_KEYS.map(({ id, width }) => (
          <div key={id} className="skeleton h-4" style={{ width }} />
        ))}
      </div>
    </div>
  );
}
