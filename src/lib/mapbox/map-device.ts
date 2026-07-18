import type { Map as MapboxMap } from "mapbox-gl";
import { MAPBOX_MAP_INIT } from "@/lib/mapbox/mapbox-3d";

/** Android phones, tablets, and narrow mobile browsers. */
export function isMobileMapDevice(): boolean {
  if (globalThis.window === undefined) return false;
  const ua = globalThis.navigator.userAgent;
  if (/Android/i.test(ua)) return true;
  return globalThis.matchMedia("(max-width: 767px)").matches;
}

export function canUseWebGl(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/** Soft timeout before showing a simplified overlay — map keeps loading underneath. */
export function mapLoadTimeoutMs(): number {
  return isMobileMapDevice() ? 18_000 : 22_000;
}

export function getMapboxInitOptions() {
  const mobile = isMobileMapDevice();
  return {
    ...MAPBOX_MAP_INIT,
    antialias: !mobile,
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: mobile,
  };
}

export function selectedPropertyFlyToPitch(): number {
  return isMobileMapDevice() ? 0 : 55;
}

/** Keep Mapbox canvas sized correctly on Android WebView (URL bar, rotation, resume). */
export function bindMapViewportResize(
  map: Pick<MapboxMap, "resize" | "on" | "off">,
  container: HTMLElement,
): () => void {
  const resize = () => {
    map.resize();
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      requestAnimationFrame(resize);
    }
  };

  const onWebGlLost = () => {
    console.warn("[map] WebGL context lost");
    resize();
  };

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  document.addEventListener("visibilitychange", onVisible);
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", resize);
  viewport?.addEventListener("scroll", resize);
  map.on("webglcontextlost", onWebGlLost);

  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }

  requestAnimationFrame(resize);

  return () => {
    window.removeEventListener("resize", resize);
    window.removeEventListener("orientationchange", resize);
    document.removeEventListener("visibilitychange", onVisible);
    viewport?.removeEventListener("resize", resize);
    viewport?.removeEventListener("scroll", resize);
    map.off("webglcontextlost", onWebGlLost);
    resizeObserver?.disconnect();
  };
}
