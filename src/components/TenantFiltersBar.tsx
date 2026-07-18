import { useEffect, useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { PropertyType } from "@/lib/property-types";
import {
  KENYA_COUNTIES,
  KENYA_LOCATIONS,
  areasForCounty,
  neighborhoodStorageValue,
  countyWideFilterValue,
  parseCountyWideFilter,
  type KenyaLocation,
} from "@/data/kenya-locations";
import { formatRentBudget } from "@/lib/format-rent-budget";
import { TENANT_MAX_RENT, TENANT_MIN_RENT, TENANT_RENT_STEP } from "@/lib/tenant-filter-defaults";

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

const ALL_TYPES = PROPERTY_TYPE_OPTIONS;

function areaChipLabel(loc: KenyaLocation): string {
  return loc.county === "Nairobi" ? loc.name : `${loc.name}, ${loc.county}`;
}

function areaFilterOptions(county: string) {
  if (county === "All") {
    return [
      { value: "All", label: "All Kenya" },
      ...[...KENYA_LOCATIONS]
        .sort((a, b) => a.name.localeCompare(b.name) || a.county.localeCompare(b.county))
        .map((loc) => ({
          value: neighborhoodStorageValue(loc),
          label: areaChipLabel(loc),
        })),
    ];
  }
  return [
    { value: countyWideFilterValue(county), label: `All ${county}` },
    ...areasForCounty(county)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((loc) => ({
        value: neighborhoodStorageValue(loc),
        label: loc.name,
      })),
  ];
}

function areaChipLocations(county: string): readonly KenyaLocation[] {
  if (county === "All") {
    return [...KENYA_LOCATIONS].sort(
      (a, b) => a.name.localeCompare(b.name) || a.county.localeCompare(b.county),
    );
  }
  return areasForCounty(county)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

function countyFromNeighborhoodFilter(neighborhood: string): string {
  if (neighborhood === "All") return "All";
  const countyWide = parseCountyWideFilter(neighborhood);
  if (countyWide) return countyWide;
  return (
    KENYA_COUNTIES.find((county) =>
      areasForCounty(county).some((loc) => neighborhoodStorageValue(loc) === neighborhood),
    ) ?? "All"
  );
}

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
  const [countyFilter, setCountyFilter] = useState(() =>
    countyFromNeighborhoodFilter(filters.neighborhood),
  );
  const [areaQuery, setAreaQuery] = useState("");

  useEffect(() => {
    setCountyFilter(countyFromNeighborhoodFilter(filters.neighborhood));
  }, [filters.neighborhood]);

  const areaOptions = useMemo(() => areaFilterOptions(countyFilter), [countyFilter]);
  const chipLocations = useMemo(() => areaChipLocations(countyFilter), [countyFilter]);

  const filteredAreaOptions = useMemo(() => {
    const q = areaQuery.trim().toLowerCase();
    const base = !q
      ? areaOptions
      : areaOptions.filter(
          (option) =>
            option.value === "All" ||
            option.value.startsWith("All ") ||
            option.label.toLowerCase().includes(q) ||
            option.value.toLowerCase().includes(q),
        );
    if (
      filters.neighborhood &&
      filters.neighborhood !== "All" &&
      !base.some((option) => option.value === filters.neighborhood)
    ) {
      const selected = areaOptions.find((option) => option.value === filters.neighborhood);
      if (selected) return [selected, ...base];
    }
    return base;
  }, [areaOptions, areaQuery, filters.neighborhood]);

  const filteredChips = useMemo(() => {
    const q = areaQuery.trim().toLowerCase();
    if (!q) return chipLocations;
    return chipLocations.filter((loc) => {
      const label = areaChipLabel(loc).toLowerCase();
      return label.includes(q) || loc.name.toLowerCase().includes(q);
    });
  }, [chipLocations, areaQuery]);

  return (
    <div
      className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-5"
      data-tour="tenant-filters"
    >
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
                min={TENANT_MIN_RENT}
                max={TENANT_MAX_RENT}
                step={TENANT_RENT_STEP}
                value={filters.maxRent}
                onChange={(e) => onChange({ maxRent: Number(e.target.value) })}
                className="w-full min-w-0 accent-primary"
                aria-label="Maximum monthly rent"
              />
              <span className="shrink-0 tabular-nums">{formatRentBudget(filters.maxRent)}</span>
            </div>
          </label>

          <label className="w-[calc(50%-0.375rem)] text-xs sm:w-auto">
            <span className="mb-1 block font-medium text-muted-foreground">County</span>
            <select
              value={countyFilter}
              onChange={(e) => {
                const nextCounty = e.target.value;
                setCountyFilter(nextCounty);
                setAreaQuery("");
                onChange({
                  neighborhood: nextCounty === "All" ? "All" : countyWideFilterValue(nextCounty),
                });
              }}
              className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
            >
              <option value="All">All Kenya</option>
              {KENYA_COUNTIES.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </label>

          <label className="w-full min-w-0 flex-[1.4] text-xs sm:min-w-[160px]">
            <span className="mb-1 block font-medium text-muted-foreground">
              Area ({areaOptions.length - 1} locations)
            </span>
            <input
              type="search"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder="Search Kilimani, Ruiru, Nyali…"
              className="mb-1.5 w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
              aria-label="Search Kenyan areas"
            />
            <select
              value={filters.neighborhood}
              onChange={(e) => onChange({ neighborhood: e.target.value })}
              className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
            >
              {filteredAreaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
        {ALL_TYPES.map((typeOption) => {
          const selectedTypes = new Set(filters.types);
          const active = selectedTypes.has(typeOption.id);
          return (
            <motion.button
              key={typeOption.id}
              type="button"
              onClick={() => {
                const next = selectedTypes.has(typeOption.id)
                  ? filters.types.filter((x) => x !== typeOption.id)
                  : [...filters.types, typeOption.id];
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
              {typeOption.label}
            </motion.button>
          );
        })}
      </div>

      <div className="mx-auto mt-1.5 flex max-w-2xl gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
        <motion.button
          type="button"
          onClick={() =>
            onChange({
              neighborhood:
                countyFilter === "All" ? "All" : countyWideFilterValue(countyFilter),
            })
          }
          animate={{
            scale:
              filters.neighborhood === "All" ||
              filters.neighborhood === countyWideFilterValue(countyFilter)
                ? 1.05
                : 1,
            background:
              filters.neighborhood === "All" ||
              filters.neighborhood === countyWideFilterValue(countyFilter)
                ? "linear-gradient(135deg, #0a5c47, #1eb88a)"
                : "rgba(255,255,255,0.05)",
            borderColor:
              filters.neighborhood === "All" ||
              filters.neighborhood === countyWideFilterValue(countyFilter)
                ? "#1eb88a"
                : "rgba(255,255,255,0.1)",
            color:
              filters.neighborhood === "All" ||
              filters.neighborhood === countyWideFilterValue(countyFilter)
                ? "#fff"
                : undefined,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold"
        >
          {countyFilter === "All" ? "All areas" : `All ${countyFilter}`}
        </motion.button>
        {filteredChips.map((loc) => {
          const value = neighborhoodStorageValue(loc);
          const active = filters.neighborhood === value;
          return (
            <motion.button
              key={value}
              type="button"
              onClick={() => onChange({ neighborhood: value })}
              animate={{
                scale: active ? 1.05 : 1,
                background: active
                  ? "linear-gradient(135deg, #0a5c47, #1eb88a)"
                  : "rgba(255,255,255,0.05)",
                borderColor: active ? "#1eb88a" : "rgba(255,255,255,0.1)",
                color: active ? "#fff" : undefined,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold"
              style={{
                boxShadow: active ? "0 4px 16px rgba(30,184,138,0.3)" : "none",
              }}
            >
              {areaChipLabel(loc)}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
