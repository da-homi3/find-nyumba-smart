import { STAT_SKELETON_KEYS } from "@/components/skeletons/skeleton-keys";

export function StatsSkeleton() {
  return (
    <section
      aria-label="Loading trust statistics"
      className="border-y border-white/10 bg-(--color-graphite)"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4 sm:px-6">
        {STAT_SKELETON_KEYS.map((id) => (
          <div key={id} className="text-center">
            <div className="skeleton mx-auto mb-2 h-10 w-20" />
            <div className="skeleton skeleton-text short mx-auto" />
          </div>
        ))}
      </div>
    </section>
  );
}
