/// <reference types="google.maps" />
import type { Property } from "@/lib/properties";
import { resolvePropertyMapCoords } from "@/lib/geo/property-map-coords";
import {
  compactKes,
  filterMappableProperties,
  priceTagSvg,
} from "@/components/tenant-map/map-constants";

type MapsLibrary = typeof google.maps;

type LegacyMarkerOptions = {
  position: google.maps.LatLng | google.maps.LatLngLiteral;
  icon?: google.maps.Icon | google.maps.Symbol | string;
  title?: string;
  zIndex?: number;
};

/** Classic map pin — markerclusterer still requires the Maps JS Marker constructor. */
export type PropertyMarker = google.maps.MVCObject & {
  __property?: Property;
  addListener(
    eventName: string,
    handler: (...args: unknown[]) => void,
  ): google.maps.MapsEventListener;
  setMap(map: google.maps.Map | null): void;
  setIcon(icon: google.maps.Icon | google.maps.Symbol | string | null): void;
  setZIndex(zIndex: number | undefined): void;
};

function legacyMarker(g: MapsLibrary, options: LegacyMarkerOptions): PropertyMarker {
  return new g.Marker(options) as PropertyMarker; // NOSONAR — markerclusterer requires classic Marker
}

function clusterMarkerSvg(size: number, count: number): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
    <circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 4}' fill='#c9a84c' fill-opacity='0.22'/>
    <circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 10}' fill='#0d4f3c' stroke='#c9a84c' stroke-width='2'/>
    <text x='50%' y='52%' text-anchor='middle' dominant-baseline='middle' font-family='Space Grotesk, system-ui, sans-serif' font-weight='700' font-size='${size / 3.2}' fill='#f5f0e0'>${count}</text>
  </svg>`;
}

export function createClusterMarker(
  g: MapsLibrary,
  count: number,
  position: google.maps.LatLng,
): PropertyMarker {
  const size = Math.min(72, 40 + Math.log2(count) * 8);
  return legacyMarker(g, {
    position,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(clusterMarkerSvg(size, count))}`,
      scaledSize: new g.Size(size, size),
      anchor: new g.Point(size / 2, size / 2),
    },
    zIndex: 999 + count,
  });
}

export function createListingMarkers(
  g: MapsLibrary,
  map: google.maps.Map,
  properties: Property[],
  query: string,
  onSelect: (property: Property) => void,
): PropertyMarker[] {
  const filtered = filterMappableProperties(properties, query);
  return filtered.map((property) => {
    const coords = resolvePropertyMapCoords(property);
    const marker = legacyMarker(g, {
      position: { lat: coords.lat, lng: coords.lng },
      icon: {
        url: priceTagSvg(compactKes(property.rent_kes).replaceAll("KES ", ""), false),
        scaledSize: new g.Size(86, 38),
        anchor: new g.Point(43, 36),
      },
      title: property.title,
    });
    marker.__property = property;

    marker.addListener("click", () => {
      onSelect(property);
      map.panTo({ lat: coords.lat, lng: coords.lng });
    });
    return marker;
  });
}

const HEAT_LAYERS = [
  { mult: 1, color: "#ff6b35", opacity: 0.22 },
  { mult: 1.8, color: "#e8b84a", opacity: 0.14 },
  { mult: 2.8, color: "#0d4f3c", opacity: 0.1 },
] as const;

function addHeatCellCircles(
  g: MapsLibrary,
  center: google.maps.LatLngLiteral,
  weight: number,
  target: google.maps.Circle[],
) {
  for (const layer of HEAT_LAYERS) {
    target.push(
      new g.Circle({
        center,
        radius: 140 * weight * layer.mult,
        strokeOpacity: 0,
        fillColor: layer.color,
        fillOpacity: layer.opacity,
        clickable: false,
        map: null,
      }),
    );
  }
}

export function buildRentHeatCircles(
  g: MapsLibrary,
  properties: Property[],
  query: string,
): google.maps.Circle[] {
  const filtered = filterMappableProperties(properties, query);
  if (filtered.length === 0) return [];

  const maxRent = Math.max(...filtered.map((p) => p.rent_kes));
  const cellSize = 0.004;
  const grid = new Map<string, { lat: number; lng: number; w: number; n: number }>();

  for (const property of filtered) {
    const coords = resolvePropertyMapCoords(property);
    const gx = Math.round(coords.lat / cellSize);
    const gy = Math.round(coords.lng / cellSize);
    const key = `${gx}:${gy}`;
    const w = 0.4 + (property.rent_kes / maxRent) * 1.6;
    const cell = grid.get(key);
    if (cell) {
      cell.lat += coords.lat;
      cell.lng += coords.lng;
      cell.w += w;
      cell.n += 1;
    } else {
      grid.set(key, { lat: coords.lat, lng: coords.lng, w, n: 1 });
    }
  }

  const circles: google.maps.Circle[] = [];
  for (const cell of grid.values()) {
    const center = { lat: cell.lat / cell.n, lng: cell.lng / cell.n };
    const weight = Math.min(3.5, cell.w);
    addHeatCellCircles(g, center, weight, circles);
  }
  return circles;
}
