import type { default as MapboxGl } from "mapbox-gl";
// Use ?url so Vite does NOT attach this as a module CSS dependency.
// Side-effect CSS imports cause "Unable to preload CSS for /assets/mapbox-*.css"
// crashes on mobile when chunk preload races after a deploy.
import mapboxCssUrl from "mapbox-gl/dist/mapbox-gl.css?url";

let workerConfigured = false;

function ensureMapboxCss(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("link[data-nyumba-mapbox-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = mapboxCssUrl;
  link.dataset.nyumbaMapboxCss = "1";
  document.head.appendChild(link);
}

/** CSP-safe Mapbox GL load (worker from bundled csp-worker, not blob). */
export async function loadMapboxGl(): Promise<typeof MapboxGl> {
  ensureMapboxCss();
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
