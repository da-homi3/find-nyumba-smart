import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { PropertyType } from "@/lib/properties";

export type TenantSort = "newest" | "price_asc" | "price_desc" | "score";

export type TenantFilters = {
  minRent: number;
  maxRent: number;
  types: PropertyType[];
  neighborhood: string;
  waterGoodOnly: boolean;
  verifiedLevel2Plus: boolean;
  bedrooms: number | null;
  sort: TenantSort;
};

const ALL_TYPES: PropertyType[] = [
  "bedsitter",
  "single_room",
  "studio",
  "one_bedroom",
  "two_bedroom",
  "three_bedroom",
];

const NEIGHBORHOODS = [
  "All",
  "Kilimani",
  "Westlands",
  "Kasarani",
  "South B",
  "Rongai",
  "Ruaka",
  "Lavington",
  "Karen",
  "Kileleshwa",
  "Roysambu",
];

type Props = {
  filters: TenantFilters;
  onChange: (patch: Partial<TenantFilters>) => void;
  resultCount: number;
  resultsLoading?: boolean;
};

export function TenantFiltersBar({
  filters,
  onChange,
  resultCount,
  resultsLoading = false,
}: Readonly<Props>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-5">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-left sm:hidden"
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {!expanded && filters.neighborhood !== "All" ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                  {filters.neighborhood}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          <motion.span
            key={resultsLoading ? "loading" : resultCount}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="shrink-0 text-xs text-muted-foreground sm:ml-auto"
          >
            {resultsLoading ? (
              "Scanning…"
            ) : (
              <>
                <strong className="text-[#1eb88a]">{resultCount}</strong> homes
              </>
            )}
          </motion.span>
        </div>

        <div
          className={`mt-3 flex flex-wrap items-end gap-3 ${expanded ? "flex" : "hidden"} sm:mt-0 sm:flex`}
        >
          <div className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:flex">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </div>

          <label className="w-full min-w-0 flex-1 text-xs sm:min-w-[120px] sm:w-auto">
            <span className="mb-1 block font-medium text-muted-foreground">Budget (KES/mo)</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5000}
                max={200000}
                step={5000}
                value={filters.maxRent}
                onChange={(e) => onChange({ maxRent: Number(e.target.value) })}
                className="w-full min-w-0 accent-primary"
                aria-label="Maximum monthly rent"
              />
              <span className="shrink-0 tabular-nums">{filters.maxRent.toLocaleString()}</span>
            </div>
          </label>

          <label className="w-[calc(50%-0.375rem)] text-xs sm:w-auto">
            <span className="mb-1 block font-medium text-muted-foreground">Area</span>
            <select
              value={filters.neighborhood}
              onChange={(e) => onChange({ neighborhood: e.target.value })}
              className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
            >
              {NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="w-[calc(50%-0.375rem)] text-xs sm:w-auto">
            <span className="mb-1 block font-medium text-muted-foreground">Beds</span>
            <select
              value={filters.bedrooms ?? ""}
              onChange={(e) =>
                onChange({ bedrooms: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="0">Studio/0</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </label>

          <label className="w-[calc(50%-0.375rem)] text-xs sm:w-auto">
            <span className="mb-1 block font-medium text-muted-foreground">Sort</span>
            <select
              value={filters.sort}
              onChange={(e) => onChange({ sort: e.target.value as TenantSort })}
              className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
              <option value="score">Highest trust</option>
            </select>
          </label>

          <label className="flex w-[calc(50%-0.375rem)] items-center gap-1.5 pb-1 text-xs font-medium sm:w-auto">
            <input
              type="checkbox"
              checked={filters.waterGoodOnly}
              onChange={(e) => onChange({ waterGoodOnly: e.target.checked })}
              className="accent-primary"
            />
            <span>Good water</span>
          </label>

          <label className="flex w-full items-center gap-1.5 pb-1 text-xs font-medium sm:w-auto">
            <input
              type="checkbox"
              checked={filters.verifiedLevel2Plus}
              onChange={(e) => onChange({ verifiedLevel2Plus: e.target.checked })}
              className="accent-primary"
            />
            <span>Verified L2+</span>
          </label>

          <motion.span
            key={resultsLoading ? "loading-desktop" : resultCount}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="ml-auto hidden text-xs text-muted-foreground sm:inline"
          >
            {resultsLoading ? (
              "Scanning…"
            ) : (
              <>
                <strong className="text-[#1eb88a]">{resultCount}</strong> homes found
              </>
            )}
          </motion.span>
        </div>
      </div>

      <div className="mx-auto mt-2 flex max-w-2xl gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
        {ALL_TYPES.map((t) => {
          const selectedTypes = new Set(filters.types);
          const active = selectedTypes.has(t);
          return (
            <motion.button
              key={t}
              type="button"
              onClick={() => {
                const next = selectedTypes.has(t)
                  ? filters.types.filter((x) => x !== t)
                  : [...filters.types, t];
                onChange({ types: next });
              }}
              animate={{
                scale: active ? 1.05 : 1,
                background: active
                  ? "linear-gradient(135deg, #0a5c47, #1eb88a)"
                  : "rgba(255,255,255,0.05)",
                borderColor: active ? "#1eb88a" : "rgba(255,255,255,0.1)",
                color: active ? "#fff" : undefined,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold capitalize"
              style={{
                boxShadow: active ? "0 4px 16px rgba(30,184,138,0.3)" : "none",
              }}
            >
              {t.replaceAll("_", " ")}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
