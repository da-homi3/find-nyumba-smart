import { useEffect, useState } from "react";

/** Desktop + motion OK — gates Three.js and heavy 3D transforms. */
export function useDeviceCapability(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory < 4;
    setCapable(!isMobile && !prefersReduced && !lowMemory);
  }, []);

  return capable;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
