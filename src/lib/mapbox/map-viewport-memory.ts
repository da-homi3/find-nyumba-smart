const VIEWPORT_KEY = "nyumba-map-viewport";

export type StoredMapViewport = {
  lng: number;
  lat: number;
  zoom: number;
};

export function readStoredMapViewport(): StoredMapViewport | null {
  if (globalThis.sessionStorage === undefined) return null;
  try {
    const raw = sessionStorage.getItem(VIEWPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMapViewport;
    if (
      !Number.isFinite(parsed.lng) ||
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.zoom)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredMapViewport(viewport: StoredMapViewport): void {
  if (globalThis.sessionStorage === undefined) return;
  try {
    sessionStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport));
  } catch {
    // ignore
  }
}
