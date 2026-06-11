import { SlidersHorizontal } from "lucide-react";
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
};

export function TenantFiltersBar({ filters, onChange, resultCount }: Props) {
  return (
    <div className="sticky top-0 z-20 border-b bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-2xl flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>

        <label className="min-w-[120px] flex-1 text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Budget (KES/mo)</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={5000}
              max={200000}
              step={5000}
              value={filters.maxRent}
              onChange={(e) => onChange({ maxRent: Number(e.target.value) })}
              className="w-full accent-primary"
              aria-label="Maximum monthly rent"
            />
            <span className="shrink-0 tabular-nums">{filters.maxRent.toLocaleString()}</span>
          </div>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Area</span>
          <select
            value={filters.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
            className="rounded-lg border bg-card px-2 py-1.5 text-sm"
          >
            {NEIGHBORHOODS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Beds</span>
          <select
            value={filters.bedrooms ?? ""}
            onChange={(e) =>
              onChange({ bedrooms: e.target.value ? Number(e.target.value) : null })
            }
            className="rounded-lg border bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="0">Studio/0</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Sort</span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as TenantSort })}
            className="rounded-lg border bg-card px-2 py-1.5 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
            <option value="score">Highest trust</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 pb-1 text-xs font-medium">
          <input
            type="checkbox"
            checked={filters.waterGoodOnly}
            onChange={(e) => onChange({ waterGoodOnly: e.target.checked })}
            className="accent-primary"
          />
          Good water
        </label>

        <label className="flex items-center gap-1.5 pb-1 text-xs font-medium">
          <input
            type="checkbox"
            checked={filters.verifiedLevel2Plus}
            onChange={(e) => onChange({ verifiedLevel2Plus: e.target.checked })}
            className="accent-primary"
          />
          Verified L2+
        </label>

        <span className="ml-auto text-xs text-muted-foreground">{resultCount} homes</span>
      </div>

      <div className="mx-auto mt-2 flex max-w-2xl flex-wrap gap-1.5">
        {ALL_TYPES.map((t) => {
          const on = filters.types.length === 0 || filters.types.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                const next = filters.types.includes(t)
                  ? filters.types.filter((x) => x !== t)
                  : [...filters.types, t];
                onChange({ types: next });
              }}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${
                on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              {t.replace("_", " ")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const defaultTenantFilters: TenantFilters = {
  minRent: 5000,
  maxRent: 200000,
  types: [],
  neighborhood: "All",
  waterGoodOnly: false,
  verifiedLevel2Plus: false,
  bedrooms: null,
  sort: "newest",
};
