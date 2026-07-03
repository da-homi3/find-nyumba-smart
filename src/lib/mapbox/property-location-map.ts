import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import { NAIROBI_CENTER } from "@/components/tenant-map/map-constants";
import { neighborhoodCentroid } from "@/lib/geo/property-map-coords";
import { loadMapboxGl } from "@/lib/mapbox/mapbox-init";
import { fitMapboxToKenya, MAPBOX_MAP_INIT, syncMapbox3DForZoom } from "@/lib/mapbox/mapbox-3d";

type MapboxGl = Awaited<ReturnType<typeof loadMapboxGl>>;

type MarkerHolder = { current: MapboxMarker | null };

export type PropertyLocationMapOptions = {
  container: HTMLDivElement;
  token: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood?: string;
  markerRef: MarkerHolder;
  onPinChange: (lat: number, lng: number) => void;
  onReady: () => void;
  isCancelled: () => boolean;
};

function resolveMapCenter(
  latitude: number | null,
  longitude: number | null,
  neighborhood?: string,
) {
  const centroid = neighborhood ? neighborhoodCentroid(neighborhood) : null;
  const hasPin = latitude != null && longitude != null;
  if (hasPin && latitude != null && longitude != null) {
    return { center: { lng: longitude, lat: latitude }, hasPin: true, centroid };
  }
  return {
    center: {
      lng: centroid?.lng ?? NAIROBI_CENTER.lng,
      lat: centroid?.lat ?? NAIROBI_CENTER.lat,
    },
    hasPin: false,
    centroid,
  };
}

function flyToPin(map: MapboxMap, lng: number, lat: number) {
  map.flyTo({
    center: [lng, lat],
    zoom: 15,
    pitch: 50,
    bearing: -15,
    duration: 1000,
    essential: true,
  });
  syncMapbox3DForZoom(map);
}

function handleMarkerDragEnd(
  marker: MapboxMarker,
  onPinChange: (lat: number, lng: number) => void,
) {
  const pos = marker.getLngLat();
  onPinChange(pos.lat, pos.lng);
}

function placeDraggableMarker(
  mapboxgl: MapboxGl,
  map: MapboxMap,
  markerRef: MarkerHolder,
  lng: number,
  lat: number,
  onPinChange: (lat: number, lng: number) => void,
) {
  markerRef.current?.remove();
  const marker = new mapboxgl.Marker({ color: "#0d4f3c", draggable: true })
    .setLngLat([lng, lat])
    .addTo(map);
  marker.on("dragend", () => handleMarkerDragEnd(marker, onPinChange));
  markerRef.current = marker;
}

function applyInitialView(
  map: MapboxMap,
  latitude: number | null,
  longitude: number | null,
  centroid: ReturnType<typeof neighborhoodCentroid>,
  placeMarker: (lng: number, lat: number) => void,
) {
  if (latitude != null && longitude != null) {
    placeMarker(longitude, latitude);
    flyToPin(map, longitude, latitude);
    return;
  }
  if (centroid) {
    map.flyTo({
      center: [centroid.lng, centroid.lat],
      zoom: 13,
      pitch: 0,
      duration: 800,
    });
    return;
  }
  fitMapboxToKenya(map, { padding: 24, pitch: 0, duration: 0, maxZoom: 6.5 });
}

function onMapLoad(
  map: MapboxMap,
  options: PropertyLocationMapOptions,
  placeMarker: (lng: number, lat: number) => void,
  centroid: ReturnType<typeof neighborhoodCentroid>,
) {
  if (options.isCancelled()) return;
  syncMapbox3DForZoom(map);
  map.resize();
  applyInitialView(map, options.latitude, options.longitude, centroid, placeMarker);
  options.onReady();
}

function onMapClick(
  map: MapboxMap,
  lng: number,
  lat: number,
  placeMarker: (lng: number, lat: number) => void,
  onPinChange: (lat: number, lng: number) => void,
) {
  placeMarker(lng, lat);
  onPinChange(lat, lng);
  flyToPin(map, lng, lat);
}

/** Creates and wires the landlord listing location Mapbox instance. */
export async function createPropertyLocationMap(
  options: PropertyLocationMapOptions,
): Promise<MapboxMap | null> {
  const mapboxgl = await loadMapboxGl();
  mapboxgl.accessToken = options.token;

  const { center, hasPin, centroid } = resolveMapCenter(
    options.latitude,
    options.longitude,
    options.neighborhood,
  );

  const map = new mapboxgl.Map({
    container: options.container,
    style: "mapbox://styles/mapbox/streets-v12",
    center: [center.lng, center.lat],
    zoom: hasPin ? 14 : 11,
    ...MAPBOX_MAP_INIT,
  });

  map.addControl(
    new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
    "top-right",
  );

  const placeMarker = (lng: number, lat: number) =>
    placeDraggableMarker(mapboxgl, map, options.markerRef, lng, lat, options.onPinChange);

  map.on("load", () => onMapLoad(map, options, placeMarker, centroid));
  map.on("style.load", () => syncMapbox3DForZoom(map));
  map.on("zoomend", () => syncMapbox3DForZoom(map));
  map.on("click", (e) =>
    onMapClick(map, e.lngLat.lng, e.lngLat.lat, placeMarker, options.onPinChange),
  );

  return map;
}

export { flyToPin };
