import { tableSkeletonKeys } from "@/components/skeletons/skeleton-keys";

export function TableSkeleton({ rows = 5, cols = 4 }: Readonly<{ rows?: number; cols?: number }>) {
  const colKeys = tableSkeletonKeys(cols, "col");
  const rowKeys = tableSkeletonKeys(rows, "row");

  return (
    <div>
      <div
        className="mb-3 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {colKeys.map((id) => (
          <div key={id} className="skeleton h-4 w-3/5" />
        ))}
      </div>
      {rowKeys.map((rowId) => (
        <div
          key={rowId}
          className="grid gap-4 border-t border-white/5 py-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {colKeys.map((colId, c) => (
            <div
              key={`${rowId}-${colId}`}
              className={`skeleton h-[18px] ${c === 0 ? "w-4/5" : "w-1/2"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
