import { describe, expect, it, vi } from "vitest";
import {
  canUseWebGl,
  isMobileMapDevice,
  mapLoadTimeoutMs,
  selectedPropertyFlyToPitch,
} from "@/lib/mapbox/map-device";

describe("map-device", () => {
  it("detects Android user agents as mobile map devices", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36",
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(isMobileMapDevice()).toBe(true);
    expect(mapLoadTimeoutMs()).toBe(8000);
    expect(selectedPropertyFlyToPitch()).toBe(0);
    vi.unstubAllGlobals();
  });

  it("reports WebGL availability in browser-like environments", () => {
    const getContext = vi.fn(() => ({}));
    vi.stubGlobal("document", {
      createElement: () => ({ getContext }),
    });
    expect(canUseWebGl()).toBe(true);
    vi.unstubAllGlobals();
  });
});
