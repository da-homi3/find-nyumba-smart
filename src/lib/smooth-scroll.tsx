import { useEffect } from "react";
import { prefersReducedMotion } from "@/hooks/useDeviceCapability";
import { isLiteServeMode } from "@/lib/app-client";

/** Marketing paths only — Lenis RAF on tenant/dashboard kills scroll responsiveness. */
function isMarketingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return (
    pathname.startsWith("/about") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/advertise") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/partnership") ||
    pathname.startsWith("/how-it-works") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms")
  );
}

function isDesktopViewport(): boolean {
  if (globalThis.window === undefined) return false;
  return globalThis.window.innerWidth >= 1024;
}

/**
 * Smooth scroll for desktop marketing pages only. Native scroll everywhere else.
 *
 * Lenis is imported dynamically: a static import puts it in the root bundle, which every
 * visitor downloads even though only desktop marketing pages ever instantiate it.
 */
export function useSmoothScroll(pathname: string) {
  useEffect(() => {
    if (isLiteServeMode()) return;
    if (prefersReducedMotion()) return;
    if (!isDesktopViewport()) return;
    if (!isMarketingPath(pathname)) return;

    let disposed = false;
    let dispose: (() => void) | undefined;

    void import("lenis").then(({ default: Lenis }) => {
      // The route may have changed while the chunk was in flight.
      if (disposed) return;

      const lenis = new Lenis({
        duration: 1.05,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
      });

      let frame = 0;
      let running = document.visibilityState === "visible";

      function raf(time: number) {
        if (!running) return;
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      }

      const onVisibility = () => {
        running = document.visibilityState === "visible";
        if (running) frame = requestAnimationFrame(raf);
        else cancelAnimationFrame(frame);
      };

      document.addEventListener("visibilitychange", onVisibility);
      if (running) frame = requestAnimationFrame(raf);

      dispose = () => {
        running = false;
        cancelAnimationFrame(frame);
        document.removeEventListener("visibilitychange", onVisibility);
        lenis.destroy();
      };
    });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [pathname]);
}
