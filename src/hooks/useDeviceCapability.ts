import { useEffect, useState } from "react";
import { isLiteServeMode } from "@/lib/app-client";

function clientViewport(): {
  innerWidth: number;
  matchMedia: (q: string) => MediaQueryList;
} | null {
  if (globalThis.window === undefined) return null;
  return globalThis.window;
}

export type MotionBudget = "full" | "lite";

/** True when motion should run (desktop, mobile, WebView). Only reduced-motion opts out. */
export function useDeviceCapability(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    const viewport = clientViewport();
    if (!viewport) {
      setCapable(false);
      return;
    }

    const prefersReduced = viewport.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCapable(!prefersReduced);
  }, []);

  return capable;
}

/** Particle / WebGL budget — lighter on phones, WebView lite, and low-memory devices. */
export function useMotionBudget(): MotionBudget {
  const [budget, setBudget] = useState<MotionBudget>("lite");

  useEffect(() => {
    const viewport = clientViewport();
    if (!viewport) {
      setBudget("lite");
      return;
    }

    const narrow = viewport.innerWidth < 768;
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory < 4;
    const saveData = Boolean(nav.connection?.saveData);
    const lite = isLiteServeMode() || narrow || lowMemory || saveData;
    setBudget(lite ? "lite" : "full");
  }, []);

  return budget;
}

export function prefersReducedMotion(): boolean {
  const viewport = clientViewport();
  if (!viewport) return false;
  return viewport.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
