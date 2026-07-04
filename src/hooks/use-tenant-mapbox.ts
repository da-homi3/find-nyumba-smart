import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import type { Property } from "@/lib/properties";
import { getListingIntel, verificationLevel } from "@/lib/listing-intel";
import { getMapboxPublicToken } from "@/lib/api/map.functions";
import {
  compactKes,
  filterMappableProperties,
  NAIROBI_CENTER,
} from "@/components/tenant-map/map-constants";
import { resolvePropertyMapCoords } from "@/lib/geo/property-map-coords";
import { loadMapboxGl } from "@/lib/mapbox/mapbox-init";
import { MAPBOX_MAP_INIT, syncHeatmapForZoom, syncMapbox3DForZoom } from "@/lib/mapbox/mapbox-3d";

const BUILD_TIME_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export async function resolveMapboxToken(): Promise<string | null> {
  const baked = BUILD_TIME_TOKEN?.trim();
  if (baked?.startsWith("pk.")) return baked;
  try {
    const cfg = await getMapboxPublicToken();
    if (cfg.token?.startsWith("pk.")) return cfg.token;
  } catch {
    // fall through to public API route
  }
  try {
    const res = await fetch("/api/mapbox-token");
    if (res.ok) {
      const cfg = (await res.json()) as { token?: string | null };
      if (cfg.token?.startsWith("pk.")) return cfg.token;
    }
  } catch {
    return null;
  }
  return null;
}

export function hasMapboxTokenSync() {
  return Boolean(BUILD_TIME_TOKEN?.trim()?.startsWith("pk."));
}

const MAP_STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

type ActiveLayer = "listings" | "security" | "water";
type MapboxModule = typeof import("mapbox-gl");

function resolveActiveLayer(showSecurity: boolean, showWater: boolean): ActiveLayer {
  if (showSecurity) return "security";
  if (showWater) return "water";
  return "listings";
}

function waterScoreLabel(p: Property): string {
  return getListingIntel(p).water.toLowerCase();
}

function securityScore(p: Property): number {
  const label = getListingIntel(p).security;
  const map: Record<string, number> = {
    Poor: 1,
    Moderate: 3,
    Good: 4,
    Excellent: 5,
  };
  return map[label] ?? 3;
}

function isBoostedListing(p: Property): 0 | 1 {
  return p.featured_until && new Date(p.featured_until).getTime() > Date.now() ? 1 : 0;
}

function listingsGeoJson(properties: Property[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: properties.map((p) => {
      const coords = resolvePropertyMapCoords(p);
      return {
        type: "Feature",
        id: p.id,
        geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
        properties: {
          id: p.id,
          price: p.rent_kes,
          priceLabel: compactKes(p.rent_kes).replace("KES ", ""),
          verificationLevel: verificationLevel(p),
          waterScore: waterScoreLabel(p),
          securityScore: securityScore(p),
          isBoosted: isBoostedListing(p),
        },
      };
    }),
  };
}

function addListingLayers(map: MapboxMap, data: GeoJSON.FeatureCollection) {
  if (!map.getSource("listings")) {
    map.addSource("listings", {
      type: "geojson",
      data,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 50,
      promoteId: "id",
    });
  }

  if (!map.getLayer("clusters")) {
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "listings",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#1eb88a", 10, "#0a5c47", 30, "#06402d"],
        "circle-radius": ["step", ["get", "point_count"], 22, 10, 30, 30, 38],
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(30,184,138,0.4)",
      },
    });
  }

  if (!map.getLayer("cluster-count")) {
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "listings",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-size": 14,
      },
      paint: { "text-color": "#ffffff" },
    });
  }

  if (!map.getLayer("unclustered-point-bg")) {
    map.addLayer({
      id: "unclustered-point-bg",
      type: "circle",
      source: "listings",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["case", ["==", ["get", "isBoosted"], 1], "#f6ad55", "#1eb88a"],
        "circle-radius": ["case", ["boolean", ["feature-state", "hover"], false], 29, 22],
        "circle-opacity": 0.95,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(30,184,138,0.4)",
      },
    });
  }

  if (!map.getLayer("unclustered-label")) {
    map.addLayer({
      id: "unclustered-label",
      type: "symbol",
      source: "listings",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": "{priceLabel}",
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    });
  }
}

function addHeatLayers(map: MapboxMap, data: GeoJSON.FeatureCollection) {
  if (!map.getSource("rent-heat")) {
    map.addSource("rent-heat", { type: "geojson", data });
    map.addLayer({
      id: "rent-heatmap",
      type: "heatmap",
      source: "rent-heat",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "price"], 5000, 0.2, 120000, 1],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(255,107,53,0)",
          0.35,
          "rgba(255,107,53,0.45)",
          0.65,
          "rgba(232,184,74,0.55)",
          1,
          "rgba(13,79,60,0.75)",
        ],
        "heatmap-radius": 36,
        "heatmap-opacity": 0.55,
      },
      layout: { visibility: "visible" },
    });
  }

  if (!map.getSource("security-heat")) {
    map.addSource("security-heat", { type: "geojson", data });
    map.addLayer({
      id: "security-heatmap",
      type: "heatmap",
      source: "security-heat",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "securityScore"], 0, 0, 5, 1],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(252,74,74,0)",
          0.3,
          "rgba(252,74,74,0.5)",
          0.6,
          "rgba(246,173,85,0.6)",
          1,
          "rgba(30,184,138,0.8)",
        ],
        "heatmap-radius": 40,
        "heatmap-opacity": 0.6,
      },
      layout: { visibility: "none" },
    });
  }
}

function setupMapLayers(map: MapboxMap, properties: Property[]) {
  try {
    const data = listingsGeoJson(properties);
    syncMapbox3DForZoom(map);
    addListingLayers(map, data);
    addHeatLayers(map, data);
  } catch (layerErr) {
    console.error("Mapbox layer setup failed:", layerErr);
  }
}

function applyMarkerColors(map: MapboxMap, activeLayer: ActiveLayer) {
  if (!map.getLayer("unclustered-point-bg")) return;

  if (activeLayer === "security") {
    map.setPaintProperty("unclustered-point-bg", "circle-color", [
      "interpolate",
      ["linear"],
      ["get", "securityScore"],
      0,
      "#fc4a4a",
      3,
      "#f6ad55",
      4,
      "#48bb78",
      5,
      "#1eb88a",
    ]);
    return;
  }

  if (activeLayer === "water") {
    map.setPaintProperty("unclustered-point-bg", "circle-color", [
      "match",
      ["get", "waterScore"],
      "excellent",
      "#1eb88a",
      "good",
      "#48bb78",
      "moderate",
      "#f6ad55",
      "poor",
      "#fc4a4a",
      "#4299e1",
    ]);
    return;
  }

  map.setPaintProperty("unclustered-point-bg", "circle-color", [
    "case",
    ["==", ["get", "isBoosted"], 1],
    "#f6ad55",
    "#1eb88a",
  ]);
}

function applyHeatVisibility(map: MapboxMap, showHeat: boolean, showSecurity: boolean) {
  syncHeatmapForZoom(map, showHeat, showSecurity);
}

function handleListingClick(
  event: MapMouseEvent,
  getProperties: () => Property[],
  setSelected: (property: Property) => void,
) {
  const props = event.features?.[0]?.properties;
  if (!props?.id) return;
  const listing = getProperties().find((item) => item.id === props.id);
  if (listing) setSelected(listing);
}

function handleClusterClick(map: MapboxMap, event: MapMouseEvent) {
  const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
  const clusterId = features[0]?.properties?.cluster_id;
  if (clusterId == null) return;
  const src = map.getSource("listings") as GeoJSONSource;
  src.getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (err || zoom == null) return;
    const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
    map.easeTo({ center: coords, zoom });
  });
}

function attachMapControls(map: MapboxMap, mapboxgl: MapboxModule["default"]) {
  map.addControl(
    new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
    "bottom-right",
  );
  map.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }),
    "bottom-right",
  );
}

function flyToNairobiMetro(map: MapboxMap, duration = 0) {
  map.flyTo({
    center: [NAIROBI_CENTER.lng, NAIROBI_CENTER.lat],
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
    duration,
    essential: true,
  });
}

export function useTenantMapbox(properties: Property[]) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMap | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const propertiesRef = useRef(properties);
  const styleRef = useRef<(typeof MAP_STYLES)[keyof typeof MAP_STYLES]>(MAP_STYLES.streets);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showWater, setShowWater] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [markerCount, setMarkerCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [mapStyle, setMapStyle] = useState<(typeof MAP_STYLES)[keyof typeof MAP_STYLES]>(
    MAP_STYLES.streets,
  );
  const [accessToken, setAccessToken] = useState<string | null>(
    BUILD_TIME_TOKEN?.trim()?.startsWith("pk.") ? BUILD_TIME_TOKEN.trim() : null,
  );
  const [tokenLoading, setTokenLoading] = useState(!hasMapboxTokenSync());

  propertiesRef.current = properties;
  const filteredProperties = filterMappableProperties(properties, query);
  const filteredRef = useRef(filteredProperties);
  filteredRef.current = filteredProperties;

  const activeLayer = resolveActiveLayer(showSecurity, showWater);
  const layerStateRef = useRef({ showHeat, showSecurity, activeLayer });
  layerStateRef.current = { showHeat, showSecurity, activeLayer };

  useEffect(() => {
    if (accessToken) return;
    let cancelled = false;
    void (async () => {
      setTokenLoading(true);
      const token = await resolveMapboxToken();
      if (!cancelled) {
        setAccessToken(token);
        setTokenLoading(false);
        if (!token) setError("Mapbox token missing. Set VITE_MAPBOX_TOKEN or MAPBOX_PUBLIC_TOKEN.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setError((prev) => (prev?.includes("offline") ? null : prev));
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (!mapInstance.current) setError("You're offline. Showing cached listings.");
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
    if (!accessToken || tokenLoading) return;
    if (!mapRef.current || mapInstance.current) return;

    let cancelled = false;

    const onZoomEnd = () => {
      const map = mapInstance.current;
      if (!map) return;
      syncMapbox3DForZoom(map);
      syncHeatmapForZoom(map, layerStateRef.current.showHeat, layerStateRef.current.showSecurity);
    };

    const onListingClick = (event: MapMouseEvent) =>
      handleListingClick(event, () => propertiesRef.current, setSelected);
    const onClusterClick = (event: MapMouseEvent) =>
      handleClusterClick(mapInstance.current!, event);
    const hoveredPinId: { current: string | number | null } = { current: null };
    const setPointer = () => {
      mapInstance.current?.getCanvas().style.setProperty("cursor", "pointer");
    };
    const clearPointer = () => {
      mapInstance.current?.getCanvas().style.removeProperty("cursor");
    };
    const onPinEnter = (event: MapMouseEvent) => {
      const map = mapInstance.current;
      if (!map) return;
      const feature = event.features?.[0];
      if (!feature?.id) return;
      if (hoveredPinId.current != null) {
        map.setFeatureState({ source: "listings", id: hoveredPinId.current }, { hover: false });
      }
      hoveredPinId.current = feature.id;
      map.setFeatureState({ source: "listings", id: feature.id }, { hover: true });
      setPointer();
    };
    const onPinLeave = () => {
      const map = mapInstance.current;
      if (map && hoveredPinId.current != null) {
        map.setFeatureState({ source: "listings", id: hoveredPinId.current }, { hover: false });
        hoveredPinId.current = null;
      }
      clearPointer();
    };
    const onLoad = () => {
      const map = mapInstance.current;
      if (!map) return;
      setupMapLayers(map, filteredRef.current);
      applyHeatVisibility(map, layerStateRef.current.showHeat, layerStateRef.current.showSecurity);
      applyMarkerColors(map, layerStateRef.current.activeLayer);
      map.resize();
      setError(null);
      setReady(true);
      setMarkerCount(filteredRef.current.length);
      flyToNairobiMetro(map, 1200);
      syncMapbox3DForZoom(map);
      syncHeatmapForZoom(map, layerStateRef.current.showHeat, layerStateRef.current.showSecurity);
    };
    const onStyleLoad = () => {
      const map = mapInstance.current;
      if (!map) return;
      setupMapLayers(map, filteredRef.current);
      applyHeatVisibility(map, layerStateRef.current.showHeat, layerStateRef.current.showSecurity);
      applyMarkerColors(map, layerStateRef.current.activeLayer);
    };
    const onMapError = (event: { error?: Error }) => {
      const message = event.error?.message ?? "";
      console.error("Mapbox error:", event);
      if (/token|401|403|unauthorized|Forbidden/i.test(message)) {
        setError(message || "Mapbox token rejected.");
      }
    };

    void (async () => {
      const mapboxgl = await loadMapboxGl();
      if (cancelled || !mapRef.current) return;

      mapboxgl.accessToken = accessToken;
      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: MAP_STYLES.streets,
        center: [NAIROBI_CENTER.lng, NAIROBI_CENTER.lat],
        zoom: 11.5,
        ...MAPBOX_MAP_INIT,
      });
      mapInstance.current = map;

      attachMapControls(map, mapboxgl);
      map.on("load", onLoad);
      map.on("style.load", onStyleLoad);
      map.on("error", onMapError);
      map.on("zoomend", onZoomEnd);
      map.on("click", "unclustered-point-bg", onListingClick);
      map.on("click", "clusters", onClusterClick);
      map.on("mouseenter", "unclustered-point-bg", onPinEnter);
      map.on("mouseleave", "unclustered-point-bg", onPinLeave);
      map.on("mouseenter", "clusters", setPointer);
      map.on("mouseleave", "clusters", clearPointer);

      if (mapRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserverRef.current = new ResizeObserver(() => map.resize());
        resizeObserverRef.current.observe(mapRef.current);
      }

      requestAnimationFrame(() => map.resize());
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      const map = mapInstance.current;
      if (map) {
        map.off("load", onLoad);
        map.off("style.load", onStyleLoad);
        map.off("error", onMapError);
        map.off("zoomend", onZoomEnd);
        map.off("click", "unclustered-point-bg", onListingClick);
        map.off("click", "clusters", onClusterClick);
        map.off("mouseenter", "unclustered-point-bg", onPinEnter);
        map.off("mouseleave", "unclustered-point-bg", onPinLeave);
        map.off("mouseenter", "clusters", setPointer);
        map.off("mouseleave", "clusters", clearPointer);
        map.remove();
      }
      mapInstance.current = null;
      setReady(false);
    };
  }, [accessToken, tokenLoading]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready) return;
    const data = listingsGeoJson(filteredProperties);
    (map.getSource("listings") as GeoJSONSource | undefined)?.setData(data);
    (map.getSource("security-heat") as GeoJSONSource | undefined)?.setData(data);
    (map.getSource("rent-heat") as GeoJSONSource | undefined)?.setData(data);
    setMarkerCount(filteredProperties.length);
  }, [filteredProperties, ready]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready) return;
    applyHeatVisibility(map, showHeat, showSecurity);
    applyMarkerColors(map, activeLayer);
  }, [showSecurity, showWater, showHeat, ready, activeLayer]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready || !selected) return;
    const coords = resolvePropertyMapCoords(selected);
    map.flyTo({
      center: [coords.lng, coords.lat],
      zoom: 15,
      pitch: 55,
      bearing: -15,
      duration: 1500,
      essential: true,
    });
    syncMapbox3DForZoom(map);
  }, [selected, ready]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready || mapStyle === styleRef.current) return;
    styleRef.current = mapStyle;
    map.setStyle(mapStyle);
  }, [mapStyle, ready]);

  const cycleMapStyle = () => {
    const styles = Object.values(MAP_STYLES);
    const idx = styles.indexOf(mapStyle);
    setMapStyle(styles[(idx + 1) % styles.length] ?? MAP_STYLES.streets);
  };

  const recenter = () => {
    const map = mapInstance.current;
    if (!map) return;
    flyToNairobiMetro(map, 1200);
    setSelected(null);
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstance.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          pitch: 45,
          duration: 1200,
        });
        syncMapbox3DForZoom(mapInstance.current!);
      },
      () => setError("Could not access your location"),
    );
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
    isOnline,
    filteredProperties,
    visibleCount,
    recenter,
    locateMe,
    cycleMapStyle,
  };
}

export function hasMapboxToken() {
  return hasMapboxTokenSync();
}
