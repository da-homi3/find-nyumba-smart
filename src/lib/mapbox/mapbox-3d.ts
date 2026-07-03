import type { Map as MapboxMap } from "mapbox-gl";

/** Continental Kenya — used for maxBounds and country-wide fit. */
export const KENYA_BOUNDS = {
  minLat: -4.75,
  maxLat: 5.05,
  minLng: 33.85,
  maxLng: 41.95,
} as const;

export const KENYA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [KENYA_BOUNDS.minLng, KENYA_BOUNDS.minLat],
  [KENYA_BOUNDS.maxLng, KENYA_BOUNDS.maxLat],
];

const BUILDING_LAYER_ID = "3d-buildings";
const TERRAIN_MIN_ZOOM = 12;
const BUILDINGS_MIN_ZOOM = 13;

function findLabelLayerId(map: MapboxMap): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  return layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;
}

function add3dBuildingsLayer(map: MapboxMap) {
  if (map.getLayer(BUILDING_LAYER_ID) || !map.getSource("composite")) return;

  map.addLayer(
    {
      id: BUILDING_LAYER_ID,
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: BUILDINGS_MIN_ZOOM,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,
          "#d4d4d8",
          50,
          "#a1a1aa",
          100,
          "#71717a",
        ],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": 0.75,
      },
    },
    findLabelLayerId(map),
  );
}

function ensureTerrainSource(map: MapboxMap) {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
}

function ensureSkyLayer(map: MapboxMap) {
  if (map.getLayer("sky")) return;
  map.addLayer({
    id: "sky",
    type: "sky",
    paint: {
      "sky-type": "atmosphere",
      "sky-atmosphere-sun": [0.0, 45.0],
      "sky-atmosphere-sun-intensity": 12,
    },
  });
}

/** Terrain, sky, and extruded buildings — only when zoomed in enough to look correct. */
export function enableMapbox3D(map: MapboxMap) {
  ensureTerrainSource(map);
  ensureSkyLayer(map);

  try {
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
  } catch (err) {
    console.warn("Mapbox terrain:", err);
  }

  if (map.getLayer("sky")) {
    map.setLayoutProperty("sky", "visibility", "visible");
  }

  add3dBuildingsLayer(map);
  if (!map.getLayer(BUILDING_LAYER_ID)) {
    map.once("idle", () => add3dBuildingsLayer(map));
  }
  if (map.getLayer(BUILDING_LAYER_ID)) {
    map.setLayoutProperty(BUILDING_LAYER_ID, "visibility", "visible");
  }
}

export function disableMapbox3D(map: MapboxMap) {
  try {
    map.setTerrain(null);
  } catch {
    // style may not support terrain yet
  }
  if (map.getLayer("sky")) {
    map.setLayoutProperty("sky", "visibility", "none");
  }
  if (map.getLayer(BUILDING_LAYER_ID)) {
    map.setLayoutProperty(BUILDING_LAYER_ID, "visibility", "none");
  }
}

/** Toggle 3D layers based on zoom so country/city views stay flat and readable. */
export function syncMapbox3DForZoom(map: MapboxMap) {
  const zoom = map.getZoom();
  if (zoom >= TERRAIN_MIN_ZOOM) {
    enableMapbox3D(map);
  } else {
    disableMapbox3D(map);
  }
}

export function syncHeatmapForZoom(map: MapboxMap, showHeat: boolean, showSecurity: boolean) {
  const zoom = map.getZoom();
  const rentVisible = showHeat && !showSecurity && zoom >= 9;
  const securityVisible = showSecurity && zoom >= 9;

  if (map.getLayer("rent-heatmap")) {
    map.setLayoutProperty("rent-heatmap", "visibility", rentVisible ? "visible" : "none");
    if (rentVisible) {
      const opacity = zoom < 11 ? 0.22 : zoom < 13 ? 0.38 : 0.5;
      map.setPaintProperty("rent-heatmap", "heatmap-opacity", opacity);
    }
  }
  if (map.getLayer("security-heatmap")) {
    map.setLayoutProperty("security-heatmap", "visibility", securityVisible ? "visible" : "none");
  }
}

export type FitKenyaOptions = {
  padding?: number | { top: number; bottom: number; left: number; right: number };
  pitch?: number;
  bearing?: number;
  duration?: number;
  maxZoom?: number;
};

export function fitMapboxToKenya(map: MapboxMap, options: FitKenyaOptions = {}) {
  map.fitBounds(KENYA_MAX_BOUNDS, {
    padding: options.padding ?? 32,
    pitch: options.pitch ?? 0,
    bearing: options.bearing ?? 0,
    duration: options.duration ?? 0,
    maxZoom: options.maxZoom ?? 6.5,
    essential: true,
  });
}

export const MAPBOX_MAP_INIT = {
  pitch: 0,
  bearing: 0,
  antialias: true,
  maxPitch: 85,
  maxBounds: KENYA_MAX_BOUNDS,
} as const;

/** @deprecated use MAPBOX_MAP_INIT */
export const MAPBOX_3D_INIT = MAPBOX_MAP_INIT;
