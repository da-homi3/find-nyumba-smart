import { Link } from "@tanstack/react-router";
import { prettyType, type Property } from "@/lib/properties";
import { formatListingPrice } from "@/lib/commercial-ranges";
import { PropertyImage } from "@/components/PropertyImage";
import { ListingsPreviewOverlay } from "@/components/ListingsPreviewOverlay";
import { isPreviewListing, previewListingStats } from "@/lib/listings-preview";
import { PlaceSearchField } from "@/components/PlaceSearchField";
import type { LocationSearchResult, MapPlaceFocus } from "@/lib/geo/location-search";
import { placeKindLabel } from "@/lib/geo/location-search";
import { Flame, Layers, MapPin, Navigation, WifiOff, X } from "lucide-react";

type TenantMapChromeProps = Readonly<{
  query: string;
  onQueryChange: (value: string) => void;
  placeFocus: MapPlaceFocus | null;
  onSelectPlace: (place: LocationSearchResult) => void;
  onClearPlace: () => void;
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
  searchProximity?: { lat: number; lng: number };
}>;

export function TenantMapChrome({
  query,
  onQueryChange,
  placeFocus,
  onSelectPlace,
  onClearPlace,
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
  searchProximity,
}: TenantMapChromeProps) {
  const listingStats = previewListingStats(filteredProperties);
  let countLabel = `${visibleCount} listing${visibleCount === 1 ? "" : "s"}`;
  if (listingStats.previewCount > 0) {
    countLabel = `${listingStats.liveCount} live · ${listingStats.previewCount} uploading`;
  }
  if (placeFocus) {
    countLabel = `${visibleCount} near ${placeFocus.label}`;
  }

  return (
    <>
      {!isOnline && (
        <div className="glass-surface absolute inset-x-4 top-20 z-20 flex items-center gap-2 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-foreground shadow-card">
          <WifiOff className="h-3.5 w-3.5 text-gold" />
          Offline — showing {filteredProperties.length} cached listings
        </div>
      )}
      {error && isOnline && (
        <div className="glass-card absolute inset-x-4 top-24 z-10 rounded-2xl p-3 text-xs shadow-card">
          <p className="font-semibold text-foreground">Fallback map active</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex flex-col gap-2">
        <div className="glass-surface pointer-events-auto flex items-center gap-2 rounded-2xl p-2 shadow-elegant">
          <PlaceSearchField
            compact
            value={query}
            onValueChange={onQueryChange}
            onSelectPlace={onSelectPlace}
            onClear={onClearPlace}
            placeholder="Search Kilimani, Yaya Centre, Ngong Rd…"
            showNearbyAfterSelect
            proximity={searchProximity}
          />
          <button
            type="button"
            onClick={onLocateMe}
            className="shrink-0 rounded-xl border border-border/60 bg-card/60 p-2 text-foreground transition hover:bg-card"
            aria-label="Use my location"
          >
            <Navigation className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRecenter}
            className="shrink-0 rounded-xl bg-primary p-2 text-primary-foreground transition hover:opacity-90"
            aria-label="Recenter on Nairobi"
          >
            <MapPin className="h-4 w-4" />
          </button>
          <Link
            to="/tenant"
            className="shrink-0 rounded-xl bg-gradient-gold px-3 py-2 text-xs font-semibold text-gold-foreground"
          >
            List view
          </Link>
        </div>
        {placeFocus ? (
          <div className="glass-surface pointer-events-auto flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs shadow-card">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{placeFocus.label}</span>
            <span className="text-muted-foreground">
              {placeKindLabel(placeFocus.kind)} · within {placeFocus.radiusKm} km
            </span>
            <button
              type="button"
              onClick={onClearPlace}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Clear place focus"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={onToggleHeat}
            className={`filter-chip inline-flex items-center gap-1.5 py-1.5 text-xs ${
              showHeat ? "is-active border-gold bg-gradient-gold text-gold-foreground shadow-soft" : ""
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> Rent heat
          </button>
          <button
            type="button"
            onClick={onToggleWater}
            className={`filter-chip inline-flex items-center gap-1.5 py-1.5 text-xs ${showWater ? "is-active" : ""}`}
          >
            Water
          </button>
          <button
            type="button"
            onClick={onToggleSecurity}
            className={`filter-chip inline-flex items-center gap-1.5 py-1.5 text-xs ${
              showSecurity ? "is-active" : ""
            }`}
          >
            Security
          </button>
          <button
            type="button"
            onClick={onTogglePanel}
            className="filter-chip inline-flex items-center gap-1.5 py-1.5 text-xs"
          >
            <Layers className="h-3.5 w-3.5" /> {countLabel}
          </button>
          {visibleCount === 0 && (
            <span className="glass-surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-amber-800 shadow-card dark:text-amber-200">
              No listings near this place — try a nearby area
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
        className={`glass-surface pointer-events-auto absolute bottom-24 left-0 top-24 z-10 hidden w-80 overflow-y-auto border-r border-border/50 p-3 shadow-card transition lg:block ${
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
            const preview = isPreviewListing(p);
            return (
              <ListingsPreviewOverlay key={p.id} active={preview} variant="card">
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex w-full gap-2 rounded-xl border p-2 text-left hover:bg-secondary"
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
                    <p className="text-[10px] text-primary">{formatListingPrice(p)}</p>
                  </div>
                </button>
              </ListingsPreviewOverlay>
            );
          })}
        </div>
      </aside>

      <div className="pointer-events-none absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 max-md:bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4rem))]">
        {selected ? (
          <div className="glass-card pointer-events-auto relative flex gap-3 rounded-2xl p-3 shadow-elegant">
            <button
              type="button"
              onClick={onClearSelected}
              className="absolute right-2 top-2 rounded-full bg-secondary p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
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
            <div className="min-w-0 flex-1 pr-6">
              <h3 className="line-clamp-1 font-display font-semibold">{selected.title}</h3>
              <p className="text-xs text-muted-foreground">
                {prettyType(selected.property_type)} · {selected.neighborhood}
                {selected.map_approximate ? (
                  <span className="ml-1 text-amber-600">· approx. area</span>
                ) : null}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-primary">{formatListingPrice(selected)}</p>
                <Link
                  to="/tenant/property/$id"
                  params={{ id: selected.id }}
                  search={{ from: "map" }}
                  className="rounded-full bg-gradient-gold px-3 py-1 text-[11px] font-semibold text-gold-foreground"
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-surface pointer-events-auto rounded-2xl px-4 py-3 text-center text-xs text-muted-foreground shadow-card">
            Search a landmark or area · tap a pin · pinch to zoom
          </div>
        )}
      </div>
    </>
  );
}
