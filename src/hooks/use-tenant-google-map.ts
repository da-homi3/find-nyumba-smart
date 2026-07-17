/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from "react";
import { getGoogleMapsWindow, loadGoogleMaps } from "@/lib/google-maps-loader";
import type { Property } from "@/lib/properties";
import {
  BROWSER_KEY,
  TRACKING_ID,
  MAP_STYLE,
  NAIROBI_CENTER,
  compactKes,
  filterMappableProperties,
  filterPropertiesNearPlace,
  priceTagSvg,
  zoomForPlaceRadiusKm,
} from "@/components/tenant-map/map-constants";
import {
  buildRentHeatCircles,
  createClusterMarker,
  createListingMarkers,
  type PropertyMarker,
} from "@/lib/tenant-map/google-map-build";
import {
  createPlaceFocus,
  type LocationSearchResult,
  type MapPlaceFocus,
} from "@/lib/geo/location-search";

type MarkerClustererType = import("@googlemaps/markerclusterer").MarkerClusterer;
type MarkerClustererModule = typeof import("@googlemaps/markerclusterer") & {
  default?: typeof import("@googlemaps/markerclusterer");
};

export function useTenantGoogleMap(properties: Property[]) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const clusterer = useRef<MarkerClustererType | null>(null);
  const heatmap = useRef<google.maps.Circle[]>([]);
  const allHeatCircles = useRef<google.maps.Circle[]>([]);
  const rebuildTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const cullRaf = useRef<number | null>(null);
  const markers = useRef<PropertyMarker[]>([]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showWater, setShowWater] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [query, setQueryState] = useState("");
  const [placeFocus, setPlaceFocus] = useState<MapPlaceFocus | null>(null);
  const [searchProximity, setSearchProximity] = useState<{ lat: number; lng: number }>({
    lat: NAIROBI_CENTER.lat,
    lng: NAIROBI_CENTER.lng,
  });
  const [markerCount, setMarkerCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const filteredProperties = useMemo(() => {
    if (placeFocus) {
      return filterPropertiesNearPlace(
        properties,
        placeFocus.lat,
        placeFocus.lng,
        placeFocus.radiusKm,
      );
    }
    return filterMappableProperties(properties, query);
  }, [properties, query, placeFocus]);

  function cullHeatmap() {
    const map = mapInstance.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) {
      allHeatCircles.current.forEach((c) => c.setMap(map));
      heatmap.current = allHeatCircles.current;
      return;
    }
    const visible: google.maps.Circle[] = [];
    for (const c of allHeatCircles.current) {
      const center = c.getCenter();
      const inView = center ? bounds.contains(center) : false;
      c.setMap(inView ? map : null);
      if (inView) visible.push(c);
    }
    heatmap.current = visible;
  }

  useEffect(() => {
    if (globalThis.document == null) return;
    const handleOnline = () => {
      setIsOnline(true);
      setError((prev) =>
        prev && /network|connection|load Google Maps|too slow/i.test(prev) ? null : prev,
      );
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (!mapInstance.current) {
        setError((prev) => prev ?? "You're offline. Showing cached listings.");
      }
    };
    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    if (!navigator.onLine) handleOffline();
    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!BROWSER_KEY) {
      setError("Google Maps key missing. Connect Google Maps Platform.");
      return;
    }
    if (error) return;
    if (!isOnline && !getGoogleMapsWindow().google?.maps) {
      setError("You're offline. Showing cached listings.");
      return;
    }
    let cancelled = false;
    const mapsWindow = getGoogleMapsWindow();
    const previousAuthFailure = mapsWindow.gm_authFailure;
    mapsWindow.gm_authFailure = () => {
      previousAuthFailure?.();
      if (!cancelled) {
        setReady(false);
        setError("Google Maps key is not authorized for this domain.");
      }
    };
    loadGoogleMaps({ apiKey: BROWSER_KEY, trackingId: TRACKING_ID })
      .then((g) => {
        if (cancelled || !mapRef.current || error) return;
        mapInstance.current = new g.maps.Map(mapRef.current, {
          center: NAIROBI_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          backgroundColor: "#0e1a14",
          styles: MAP_STYLE,
          gestureHandling: "greedy",
        });
        const map = mapInstance.current;
        map.addListener("idle", () => {
          const center = map.getCenter();
          if (center) setSearchProximity({ lat: center.lat(), lng: center.lng() });
        });
        setReady(true);
      })
      .catch((e) => {
        console.warn("[tenant-map] Google Maps load failed:", e);
        setError(e instanceof Error ? e.message : "Failed to load map");
      });
    return () => {
      cancelled = true;
      mapsWindow.gm_authFailure = previousAuthFailure;
    };
  }, [error, isOnline]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    if (rebuildTimer.current) globalThis.clearTimeout(rebuildTimer.current);
    rebuildTimer.current = globalThis.setTimeout(() => {
      void rebuild();
    }, 150);

    async function rebuild() {
      const g = getGoogleMapsWindow().google;
      const map = mapInstance.current;
      if (!g || !map) return;

      const mcMod = (await import("@googlemaps/markerclusterer")) as MarkerClustererModule;
      const MarkerClusterer = mcMod.MarkerClusterer ?? mcMod.default?.MarkerClusterer;
      const SuperClusterAlgorithm =
        mcMod.SuperClusterAlgorithm ?? mcMod.default?.SuperClusterAlgorithm;
      if (!MarkerClusterer || !SuperClusterAlgorithm) {
        throw new Error("Marker clusterer failed to load");
      }

      clusterer.current?.clearMarkers();
      markers.current.forEach((m) => m.setMap(null));
      markers.current = [];
      setMarkerCount(0);

      const newMarkers = createListingMarkers(g.maps, map, filteredProperties, setSelected);
      markers.current = newMarkers;
      setMarkerCount(newMarkers.length);

      clusterer.current = new MarkerClusterer({
        map,
        markers: newMarkers,
        algorithm: new SuperClusterAlgorithm({ radius: 70, maxZoom: 15 }),
        renderer: {
          render: ({ count, position }: { count: number; position: google.maps.LatLng }) =>
            createClusterMarker(g.maps, count, position),
        },
      });

      allHeatCircles.current.forEach((c) => c.setMap(null));
      allHeatCircles.current = buildRentHeatCircles(g.maps, filteredProperties);
      heatmap.current = [];
      if (showHeat) cullHeatmap();
    }
  }, [ready, filteredProperties, showHeat]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;
    const schedule = () => {
      if (cullRaf.current) cancelAnimationFrame(cullRaf.current);
      cullRaf.current = requestAnimationFrame(() => {
        if (showHeat) cullHeatmap();
      });
    };
    const listener = map.addListener("idle", schedule);
    return () => {
      listener.remove();
      if (cullRaf.current) cancelAnimationFrame(cullRaf.current);
    };
  }, [ready, showHeat]);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (showHeat) {
      cullHeatmap();
    } else {
      allHeatCircles.current.forEach((c) => c.setMap(null));
      heatmap.current = [];
    }
  }, [showHeat]);

  useEffect(() => {
    const g = getGoogleMapsWindow().google;
    if (!g) return;
    markers.current.forEach((m) => {
      const p = m.__property;
      if (!p) return;
      const isActive = selected?.id === p.id;
      m.setIcon({
        url: priceTagSvg(compactKes(p.rent_kes).replaceAll("KES ", ""), isActive),
        scaledSize: new g.maps.Size(86, 38),
        anchor: new g.maps.Point(43, 36),
      });
      m.setZIndex(isActive ? 9999 : undefined);
    });
  }, [selected]);

  const recenter = () => {
    mapInstance.current?.panTo(NAIROBI_CENTER);
    mapInstance.current?.setZoom(12);
    setSelected(null);
    setPlaceFocus(null);
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapInstance.current?.panTo(center);
        mapInstance.current?.setZoom(14);
      },
      () => setError("Could not access your location"),
    );
  };

  const focusPlace = (place: LocationSearchResult) => {
    const focus = createPlaceFocus(place);
    setPlaceFocus(focus);
    setQueryState(place.neighborhood ?? place.label);
    setSelected(null);
    mapInstance.current?.panTo({ lat: focus.lat, lng: focus.lng });
    mapInstance.current?.setZoom(zoomForPlaceRadiusKm(focus.radiusKm));
  };

  const clearPlaceFocus = () => {
    setPlaceFocus(null);
    setQueryState("");
  };

  const setQuery = (value: string) => {
    setQueryState(value);
    if (placeFocus) setPlaceFocus(null);
  };

  const visibleCount = ready && !error ? markerCount : filteredProperties.length;

  return {
    mapRef,
    ready,
    error,
    selected,
    setSelected,
    showHeat,
    setShowHeat,
    showWater,
    setShowWater,
    showSecurity,
    setShowSecurity,
    panelOpen,
    setPanelOpen,
    query,
    setQuery,
    placeFocus,
    focusPlace,
    clearPlaceFocus,
    isOnline,
    filteredProperties,
    visibleCount,
    searchProximity,
    recenter,
    locateMe,
  };
}
