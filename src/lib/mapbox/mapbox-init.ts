import type { default as MapboxGl } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

let workerConfigured = false;

/** CSP-safe Mapbox GL load (worker from bundled csp-worker, not blob). */
export async function loadMapboxGl(): Promise<typeof MapboxGl> {
  const mapboxgl = (await import("mapbox-gl")).default;

  if (!workerConfigured && typeof Worker !== "undefined") {
    mapboxgl.workerClass = class MapboxCspWorker extends Worker {
      constructor() {
        super(new URL("mapbox-gl/dist/mapbox-gl-csp-worker.js", import.meta.url), {
          type: "module",
        });
      }
    };
    workerConfigured = true;
  }

  return mapboxgl;
}
