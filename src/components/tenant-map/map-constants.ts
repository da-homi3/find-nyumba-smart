/// <reference types="google.maps" />
import { prettyType, type Property } from "@/lib/properties";
import { resolvePropertyMapCoords } from "@/lib/geo/property-map-coords";
import { haversineKm } from "@/lib/geo/location-search";

export const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };
export const NAIROBI_BOUNDS = {
  minLat: -1.46,
  maxLat: -1.16,
  minLng: 36.62,
  maxLng: 37.08,
};
export const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const TRACKING_ID = import.meta.env.VITE_GOOGLE_MAPS_TRACKING_ID;

/** Readable dark Google basemap — roads stay visible (not near-black). */
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a2420" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a8b8b0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a2420" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d4c08a" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2e3f37" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#24332c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8aa396" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3d5a4a" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#d4c08a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1c18" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a7a66" }] },
];

export function compactKes(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${Math.round(n / 1_000)}K`;
  return `KES ${n}`;
}

export function priceTagSvg(label: string, active: boolean) {
  const bg = active ? "#c9a84c" : "#0d4f3c";
  const fg = active ? "#1a1a1a" : "#ffffff";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='86' height='38' viewBox='0 0 86 38'>
    <defs><filter id='s' x='-20%' y='-20%' width='140%' height='160%'>
      <feDropShadow dx='0' dy='2' stdDeviation='2' flood-color='#000' flood-opacity='0.35'/>
    </filter></defs>
    <g filter='url(#s)'>
      <rect x='1' y='1' rx='14' ry='14' width='84' height='28' fill='${bg}' stroke='#fff' stroke-width='1.5'/>
      <path d='M40 29 L43 36 L46 29 Z' fill='${bg}' stroke='#fff' stroke-width='1.5'/>
    </g>
    <text x='43' y='19' font-family='DM Sans, system-ui, sans-serif' font-size='12' font-weight='700' text-anchor='middle' fill='${fg}'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function filterMappableProperties(properties: Property[], query: string): Property[] {
  const qq = query.trim().toLowerCase();
  return properties
    .filter((p) => {
      if (p.is_active === false) return false;
      if (!qq) return true;
      return (
        p.neighborhood.toLowerCase().includes(qq) ||
        p.title.toLowerCase().includes(qq) ||
        prettyType(p.property_type).toLowerCase().includes(qq)
      );
    })
    .map((p) => {
      const coords = resolvePropertyMapCoords(p);
      return {
        ...p,
        latitude: coords.lat,
        longitude: coords.lng,
        map_approximate: coords.approximate,
      };
    });
}

/** Keep listings within radius of a searched place (landmark / area focus). */
export function filterPropertiesNearPlace(
  properties: Property[],
  lat: number,
  lng: number,
  radiusKm: number,
): Property[] {
  return properties
    .filter((p) => p.is_active !== false)
    .map((p) => {
      const coords = resolvePropertyMapCoords(p);
      return {
        ...p,
        latitude: coords.lat,
        longitude: coords.lng,
        map_approximate: coords.approximate,
        _km: haversineKm(lat, lng, coords.lat, coords.lng),
      };
    })
    .filter((p) => p._km <= radiusKm)
    .sort((a, b) => a._km - b._km)
    .map(({ _km: _distanceKm, ...p }) => p);
}

export function zoomForPlaceRadiusKm(radiusKm: number): number {
  if (radiusKm <= 1.5) return 15;
  if (radiusKm <= 2.5) return 14;
  if (radiusKm <= 4) return 13.2;
  if (radiusKm <= 7) return 12.2;
  return 11.2;
}

export function projectToFallbackMap(p: Property) {
  const coords = resolvePropertyMapCoords(p);
  const x =
    ((coords.lng - NAIROBI_BOUNDS.minLng) / (NAIROBI_BOUNDS.maxLng - NAIROBI_BOUNDS.minLng)) * 100;
  const y =
    ((NAIROBI_BOUNDS.maxLat - coords.lat) / (NAIROBI_BOUNDS.maxLat - NAIROBI_BOUNDS.minLat)) * 100;
  return {
    left: `${Math.min(94, Math.max(6, x))}%`,
    top: `${Math.min(88, Math.max(12, y))}%`,
  };
}
