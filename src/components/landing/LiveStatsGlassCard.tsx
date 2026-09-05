import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import type { PublicStats } from "@/lib/api/stats.functions";
import { Star } from "lucide-react";

type LiveStats = Pick<
  PublicStats,
  "activeListings" | "verifiedListings" | "neighborhoodCount" | "tenantRating"
>;

export function LiveStatsGlassCard({
  stats,
  loading = false,
}: Readonly<{ stats?: Partial<LiveStats> | null; loading?: boolean }>) {
  const active = stats?.activeListings ?? 0;
  const verified = stats?.verifiedListings ?? 0;
  const hoods = stats?.neighborhoodCount ?? 0;
  const rating = stats?.tenantRating ?? 0;

  return (
    <aside
      className="glass-panel w-full max-w-sm rounded-3xl p-5 text-white sm:p-6"
      aria-label="Live NyumbaSearch stats"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Live on NyumbaSearch
        </p>
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3" aria-busy>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCell label="Active listings" value={active} />
          <StatCell label="Verified homes" value={verified} />
          <StatCell label="Neighborhoods" value={hoods} />
          <div className="rounded-2xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
              Tenant rating
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" aria-hidden />
              {rating > 0 ? rating.toFixed(1) : "—"}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

function StatCell({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
        {value > 0 ? <CountUp value={value} /> : "—"}
      </p>
    </div>
  );
}

function CountUp({ value }: Readonly<{ value: number }>) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const formatted = value.toLocaleString("en-KE");
  const [display, setDisplay] = useState(formatted);

  useEffect(() => {
    setDisplay(formatted);
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.6,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.floor(v).toLocaleString("en-KE")),
    });
    return () => controls.stop();
  }, [inView, value, formatted]);

  return <span ref={ref}>{display}</span>;
}
