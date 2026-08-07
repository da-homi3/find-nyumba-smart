import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { resolveMapboxToken } from "@/hooks/use-tenant-mapbox";
import {
  formatDistanceKm,
  nearbyKenyaLocations,
  placeKindLabel,
  resolveBestLocation,
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
  /** Soft map viewport bias (minLng, minLat, maxLng, maxLat). */
  bbox?: [number, number, number, number];
}>;

function proximityOrUndefined(
  lat: number | undefined,
  lng: number | undefined,
): { lat: number; lng: number } | undefined {
  if (lat == null || lng == null) return undefined;
  return { lat, lng };
}

function PlaceSearchResults({
  listId,
  loading,
  resolvingEnter,
  results,
  activeIndex,
  onActiveIndex,
  onSelect,
}: Readonly<{
  listId: string;
  loading: boolean;
  resolvingEnter: boolean;
  results: LocationSearchResult[];
  activeIndex: number;
  onActiveIndex: (index: number) => void;
  onSelect: (place: LocationSearchResult) => void;
}>) {
  const busy = loading || resolvingEnter;
  return (
    <div
      id={listId}
      className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-72 overflow-y-auto rounded-xl border bg-card shadow-elegant"
    >
      {busy ? (
        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {resolvingEnter ? "Going to best match…" : "Searching places near the map…"}
        </div>
      ) : null}
      {!busy && results.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          No places found. Try a landmark, road, or neighbourhood name.
        </p>
      ) : null}
      {!busy && results.length > 0 ? (
        <ul className="py-1">
          {results.map((result, index) => {
            const distanceHint =
              result.distanceKm != null && result.distanceKm < 80
                ? ` · ${formatDistanceKm(result.distanceKm)}`
                : "";
            return (
              <li key={result.id}>
                <button
                  type="button"
                  id={`${listId}-opt-${index}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onMouseEnter={() => onActiveIndex(index)}
                  onClick={() => onSelect(result)}
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
                        {distanceHint}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function NearbyPlaces({
  places,
  onSelect,
}: Readonly<{
  places: LocationSearchResult[];
  onSelect: (place: LocationSearchResult) => void;
}>) {
  if (places.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="self-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Nearby
      </span>
      {places.map((place) => (
        <button
          key={place.id}
          type="button"
          onClick={() => onSelect(place)}
          className="rounded-full border bg-background/90 px-2.5 py-1 text-[11px] font-medium hover:border-primary/40 hover:bg-secondary"
        >
          {place.label}
        </button>
      ))}
    </div>
  );
}

function handlePlaceSearchKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  resultsLength: number,
  onEscape: () => void,
  onArrow: (delta: 1 | -1) => void,
  onEnter: () => void,
) {
  if (e.key === "Escape") {
    onEscape();
    return;
  }
  if (e.key === "ArrowDown" && resultsLength > 0) {
    e.preventDefault();
    onArrow(1);
    return;
  }
  if (e.key === "ArrowUp" && resultsLength > 0) {
    e.preventDefault();
    onArrow(-1);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    onEnter();
  }
}

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
  bbox,
}: PlaceSearchFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const resultsRef = useRef<LocationSearchResult[]>([]);
  const bboxRef = useRef<PlaceSearchFieldProps["bbox"]>(undefined);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [nearby, setNearby] = useState<LocationSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolvingEnter, setResolvingEnter] = useState(false);

  resultsRef.current = results;
  bboxRef.current = bbox;

  useEffect(() => {
    let cancelled = false;
    void resolveMapboxToken().then((token) => {
      if (!cancelled) tokenRef.current = token;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Serialized so the effect re-runs on content change, not array identity.
  const bboxKey = bbox ? bbox.join(",") : "";
  const proximityLat = proximity?.lat;
  const proximityLng = proximity?.lng;

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
        proximity: proximityOrUndefined(proximityLat, proximityLng),
        bbox: bboxRef.current,
      }).then((next) => {
        if (cancelled) return;
        setResults(next);
        setLoading(false);
        setActiveIndex(next.length > 0 ? 0 : -1);
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, proximityLat, proximityLng, bboxKey]);

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

  async function commitBestMatch() {
    const existing = resultsRef.current;
    if (existing.length > 0) {
      const pick =
        activeIndex >= 0 && existing[activeIndex] ? existing[activeIndex]! : existing[0]!;
      selectPlace(pick);
      return;
    }

    const query = value.trim();
    if (query.length < 2) return;

    setResolvingEnter(true);
    try {
      if (!tokenRef.current) tokenRef.current = await resolveMapboxToken();
      const best = await resolveBestLocation(query, {
        mapboxToken: tokenRef.current,
        proximity: proximityOrUndefined(proximity?.lat, proximity?.lng),
        bbox,
      });
      if (best) selectPlace(best);
    } finally {
      setResolvingEnter(false);
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
    open &&
    (loading || resolvingEnter || results.length > 0 || (value.trim().length >= 2 && !loading));

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
          onKeyDown={(e) =>
            handlePlaceSearchKeyDown(
              e,
              results.length,
              () => setOpen(false),
              (delta) =>
                setActiveIndex((i) => {
                  if (delta === 1) return (i + 1) % results.length;
                  return i <= 0 ? results.length - 1 : i - 1;
                }),
              () => void commitBestMatch(),
            )
          }
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
        <PlaceSearchResults
          listId={listId}
          loading={loading}
          resolvingEnter={resolvingEnter}
          results={results}
          activeIndex={activeIndex}
          onActiveIndex={setActiveIndex}
          onSelect={selectPlace}
        />
      ) : null}

      {!showDropdown ? <NearbyPlaces places={nearby} onSelect={selectPlace} /> : null}
    </div>
  );
}
