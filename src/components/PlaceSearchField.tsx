import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { resolveMapboxToken } from "@/hooks/use-tenant-mapbox";
import {
  nearbyKenyaLocations,
  placeKindLabel,
  searchLocations,
  type LocationSearchResult,
} from "@/lib/geo/location-search";
import { cn } from "@/lib/utils";

type PlaceSearchFieldProps = Readonly<{
  value: string;
  onValueChange: (value: string) => void;
  onSelectPlace: (place: LocationSearchResult) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Show Kenya neighborhoods near the last selected place. */
  showNearbyAfterSelect?: boolean;
  compact?: boolean;
  proximity?: { lat: number; lng: number };
}>;

export function PlaceSearchField({
  value,
  onValueChange,
  onSelectPlace,
  onClear,
  placeholder = "Search area, landmark, road… e.g. Yaya Centre, Kilimani",
  className,
  inputClassName,
  showNearbyAfterSelect = true,
  compact = false,
  proximity,
}: PlaceSearchFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [nearby, setNearby] = useState<LocationSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    void resolveMapboxToken().then((token) => {
      if (!cancelled) tokenRef.current = token;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchLocations(query, {
        mapboxToken: tokenRef.current,
        limit: 10,
        proximity:
          proximity?.lat != null && proximity.lng != null
            ? { lat: proximity.lat, lng: proximity.lng }
            : undefined,
      }).then((next) => {
        if (cancelled) return;
        setResults(next);
        setLoading(false);
        setActiveIndex(next.length > 0 ? 0 : -1);
      });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, proximity?.lat, proximity?.lng]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function selectPlace(place: LocationSearchResult) {
    onValueChange(place.neighborhood ?? place.label);
    onSelectPlace(place);
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
    if (showNearbyAfterSelect) {
      setNearby(
        nearbyKenyaLocations(place.lat, place.lng, {
          limit: 5,
          maxKm: 8,
          excludeName: place.label,
        }),
      );
    }
  }

  function clearAll() {
    onValueChange("");
    setResults([]);
    setNearby([]);
    setOpen(false);
    onClear?.();
  }

  const showDropdown =
    open && (loading || results.length > 0 || (value.trim().length >= 2 && !loading));

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <div className={cn("relative flex items-center", compact && "min-w-0 flex-1")}>
        <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setNearby([]);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showDropdown || results.length === 0) {
              if (e.key === "Escape") setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
              e.preventDefault();
              selectPlace(results[activeIndex]!);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "w-full bg-transparent py-1.5 pl-6 pr-8 text-sm outline-none placeholder:text-muted-foreground",
            inputClassName,
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={clearAll}
            className="absolute right-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-72 overflow-y-auto rounded-xl border bg-card shadow-elegant"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching areas & landmarks…
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              No places found. Try a landmark, road, or neighbourhood name.
            </p>
          ) : (
            <ul className="py-1">
              {results.map((result, index) => (
                <li key={result.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectPlace(result)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2.5 text-left",
                      index === activeIndex ? "bg-secondary/80" : "hover:bg-secondary/60",
                    )}
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{result.label}</span>
                        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {placeKindLabel(result.kind)}
                        </span>
                      </span>
                      {result.subtitle ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {nearby.length > 0 && !showDropdown ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="self-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Nearby
          </span>
          {nearby.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => selectPlace(place)}
              className="rounded-full border bg-background/90 px-2.5 py-1 text-[11px] font-medium hover:border-primary/40 hover:bg-secondary"
            >
              {place.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
