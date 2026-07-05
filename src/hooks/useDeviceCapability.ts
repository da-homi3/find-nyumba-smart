import { useEffect, useState } from "react";
import { isLiteServeMode } from "@/lib/app-client";

function clientViewport(): {
  innerWidth: number;
  matchMedia: (q: string) => MediaQueryList;
} | null {
  if (typeof globalThis.window === "undefined") return null;
  return globalThis.window;
}

/** Desktop + motion OK — gates Three.js and heavy 3D transforms. Disabled in Android lite mode. */
export function useDeviceCapability(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    if (isLiteServeMode()) {
      setCapable(false);
      return;
    }

    const viewport = clientViewport();
    if (!viewport) {
      setCapable(false);
      return;
    }

    const isMobile = viewport.innerWidth < 768;
    const prefersReduced = viewport.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory < 4;
    setCapable(!isMobile && !prefersReduced && !lowMemory);
  }, []);

  return capable;
}

export function prefersReducedMotion(): boolean {
  const viewport = clientViewport();
  if (!viewport) return false;
  return viewport.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
