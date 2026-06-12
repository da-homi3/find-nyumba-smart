import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { formatKes } from "@/lib/properties";
import { readRecentlyViewed, type RecentProperty } from "@/lib/recently-viewed";
import { PropertyImage } from "@/components/PropertyImage";

export function RecentlyViewedStrip() {
  const [items, setItems] = useState<RecentProperty[]>([]);

  useEffect(() => {
    setItems(readRecentlyViewed());
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-2xl px-5 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Clock className="h-4 w-4 text-primary" /> Recently viewed
        </h2>
        <Link
          to="/tenant/compare"
          search={{
            ids: items
              .slice(0, 3)
              .map((p) => p.id)
              .join(","),
          }}
          className="text-xs font-medium text-primary"
        >
          Compare →
        </Link>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {items.map((p) => (
          <Link
            key={p.id}
            to="/tenant/property/$id"
            params={{ id: p.id }}
            className="w-56 shrink-0 rounded-xl border bg-card p-2 hover:bg-secondary"
          >
            {p.images[0] ? (
              <PropertyImage
                src={p.images[0]}
                seed={p.id}
                alt=""
                className="h-24 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="grid h-24 place-items-center rounded-lg bg-muted text-xs text-muted-foreground">
                No photo
              </div>
            )}
            <p className="mt-2 line-clamp-1 text-xs font-semibold">{p.title}</p>
            <p className="text-[10px] text-primary">{formatKes(p.rent_kes)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
