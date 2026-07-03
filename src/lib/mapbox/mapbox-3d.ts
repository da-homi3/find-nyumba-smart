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
      minzoom: 13,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,
          "#0d1a14",
          50,
          "#1c2d20",
          100,
          "#2d4a35",
        ],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": 0.85,
      },
    },
    findLabelLayerId(map),
  );
}

/** Terrain, atmosphere sky, and extruded buildings — re-safe after style changes. */
export function enableMapbox3D(map: MapboxMap) {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }

  try {
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
  } catch (err) {
    console.warn("Mapbox terrain:", err);
  }

  if (!map.getLayer("sky")) {
    map.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0.0, 90.0],
        "sky-atmosphere-sun-intensity": 15,
      },
    });
  }

  add3dBuildingsLayer(map);
  if (!map.getLayer(BUILDING_LAYER_ID)) {
    map.once("idle", () => add3dBuildingsLayer(map));
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
    pitch: options.pitch ?? 45,
    bearing: options.bearing ?? -17.6,
    duration: options.duration ?? 0,
    maxZoom: options.maxZoom ?? 6.8,
    essential: true,
  });
}

export const MAPBOX_3D_INIT = {
  pitch: 45,
  bearing: -17.6,
  antialias: true,
  maxPitch: 85,
  maxBounds: KENYA_MAX_BOUNDS,
} as const;
