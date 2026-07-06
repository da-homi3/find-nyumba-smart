import { Link } from "@tanstack/react-router";
import { formatKes, prettyType, type Property } from "@/lib/properties";
import { PropertyImage } from "@/components/PropertyImage";
import { Flame, Layers, MapPin, Navigation, WifiOff, X } from "lucide-react";
import { shouldObscureListing } from "@/lib/listing-visibility";
import { cn } from "@/lib/utils";

type TenantMapChromeProps = Readonly<{
  query: string;
  onQueryChange: (value: string) => void;
  showHeat: boolean;
  onToggleHeat: () => void;
  showWater: boolean;
  onToggleWater: () => void;
  showSecurity: boolean;
  onToggleSecurity: () => void;
  visibleCount: number;
  onLocateMe: () => void;
  onRecenter: () => void;
  isOnline: boolean;
  error: string | null;
  filteredProperties: Property[];
  panelOpen: boolean;
  onTogglePanel: () => void;
  selected: Property | null;
  onSelect: (property: Property) => void;
  onClearSelected: () => void;
  mapProvider?: "mapbox" | "google";
}>;

export function TenantMapChrome({
  query,
  onQueryChange,
  showHeat,
  onToggleHeat,
  showWater,
  onToggleWater,
  showSecurity,
  onToggleSecurity,
  visibleCount,
  onLocateMe,
  onRecenter,
  isOnline,
  error,
  filteredProperties,
  panelOpen,
  onTogglePanel,
  selected,
  onSelect,
  onClearSelected,
}: TenantMapChromeProps) {
  const selectedObscured = selected ? shouldObscureListing(selected) : false;

  return (
    <>
      {!isOnline && (
        <div className="absolute inset-x-4 top-20 z-20 flex items-center gap-2 rounded-full border border-gold/40 bg-card/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-card backdrop-blur">
          <WifiOff className="h-3.5 w-3.5 text-gold" />
          Offline — showing {filteredProperties.length} cached listings
        </div>
      )}
      {error && isOnline && (
        <div className="absolute inset-x-4 top-24 z-10 rounded-2xl border bg-card/95 p-3 text-xs shadow-card backdrop-blur">
          <p className="font-semibold text-foreground">Fallback map active</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-background/95 p-2 shadow-elegant backdrop-blur">
          <MapPin className="ml-2 h-4 w-4 text-primary" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search Kilimani, Westlands, bedsitter…"
            className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onLocateMe}
            className="rounded-xl border bg-background p-2 text-foreground"
            aria-label="Use my location"
          >
            <Navigation className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRecenter}
            className="rounded-xl bg-foreground p-2 text-background transition hover:opacity-90"
            aria-label="Recenter on Nairobi"
          >
            <MapPin className="h-4 w-4" />
          </button>
          <Link
            to="/tenant"
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            List view
          </Link>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={onToggleHeat}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-card backdrop-blur transition ${
              showHeat
                ? "bg-gradient-gold text-gold-foreground"
                : "bg-background/90 text-foreground"
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> Rent heat
          </button>
          <button
            type="button"
            onClick={onToggleWater}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-card backdrop-blur ${
              showWater ? "bg-blue-500/20 text-blue-700" : "bg-background/90"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Water
          </button>
          <button
            type="button"
            onClick={onToggleSecurity}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-card backdrop-blur ${
              showSecurity ? "bg-red-500/15 text-red-700" : "bg-background/90"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Security
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-card backdrop-blur">
            {visibleCount} listing{visibleCount === 1 ? "" : "s"}
          </span>
          {visibleCount === 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs text-amber-800 shadow-card backdrop-blur">
              No listings match — try another area
            </span>
          )}
        </div>
      </div>

      {showWater && (
        <div
          className="pointer-events-none absolute inset-0 z-5 bg-blue-500/10 mix-blend-multiply"
          aria-hidden
        />
      )}
      {showSecurity && (
        <div
          className="pointer-events-none absolute inset-0 z-5 bg-red-500/10 mix-blend-multiply"
          aria-hidden
        />
      )}

      <aside
        className={`pointer-events-auto absolute bottom-24 left-0 top-24 z-10 hidden w-80 overflow-y-auto border-r bg-background/95 p-3 shadow-card backdrop-blur transition lg:block ${
          panelOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={onTogglePanel}
          className="mb-2 text-xs font-semibold text-primary"
        >
          {panelOpen ? "Hide panel" : "Show"}
        </button>
        <div className="space-y-3">
          {filteredProperties.slice(0, 8).map((p) => {
            const obscured = shouldObscureListing(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="relative flex w-full gap-2 overflow-hidden rounded-xl border p-2 text-left hover:bg-secondary"
              >
                <div
                  className={cn("flex min-w-0 gap-2", obscured && "select-none blur-[4px]")}
                  aria-hidden={obscured ? true : undefined}
                >
                  {p.images[0] ? (
                    <PropertyImage
                      src={p.images[0]}
                      seed={p.id}
                      alt=""
                      className="h-14 w-16 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{p.title}</p>
                    <p className="text-[10px] text-primary">{formatKes(p.rent_kes)}</p>
                  </div>
                </div>
                {obscured ? (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center bg-card/55 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur-[1px]">
                    Preview
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10">
        {selected ? (
          <div className="pointer-events-auto relative flex gap-3 overflow-hidden rounded-2xl border bg-card p-3 shadow-elegant">
            <button
              type="button"
              onClick={onClearSelected}
              className="absolute right-2 top-2 rounded-full bg-secondary p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div
              className={cn(
                "flex min-w-0 flex-1 gap-3 pr-6",
                selectedObscured && "select-none blur-[5px]",
              )}
              aria-hidden={selectedObscured ? true : undefined}
            >
              {selected.images[0] ? (
                <PropertyImage
                  src={selected.images[0]}
                  seed={selected.id}
                  alt={selected.title}
                  className="h-20 w-24 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-20 w-24 shrink-0 place-items-center rounded-xl bg-muted text-[10px] text-muted-foreground">
                  No image
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 font-display font-semibold">{selected.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {prettyType(selected.property_type)} · {selected.neighborhood}
                  {selected.map_approximate ? (
                    <span className="ml-1 text-amber-600">· approx. area</span>
                  ) : null}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-primary">
                    {formatKes(selected.rent_kes)}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <Link
                    to="/tenant/property/$id"
                    params={{ id: selected.id }}
                    className="rounded-full bg-gradient-gold px-3 py-1 text-[11px] font-semibold text-gold-foreground"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
            {selectedObscured ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/45 px-4 text-center backdrop-blur-[1px]">
                <span className="rounded-full border bg-background/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Preview listing
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="pointer-events-auto rounded-2xl bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground shadow-card backdrop-blur">
            Tap a pin or cluster · pinch to zoom · drag with two fingers to tilt 3D
          </div>
        )}
      </div>
    </>
  );
}
