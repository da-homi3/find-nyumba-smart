import { useEffect, useMemo, useState } from "react";
import {
  browseOriginFromGeolocation,
  resolveBrowseOriginFallback,
  writeStoredBrowseOrigin,
  type BrowseOrigin,
} from "@/lib/geo/tenant-browse-origin";

const GEO_TIMEOUT_MS = 8_000;

/**
 * Tenant browse center: geolocation when allowed, else selected area / map / Nairobi.
 */
export function useTenantBrowseOrigin(neighborhoodFilter: string): {
  origin: BrowseOrigin;
  locating: boolean;
} {
  const fallback = useMemo(
    () => resolveBrowseOriginFallback(neighborhoodFilter),
    [neighborhoodFilter],
  );
  const [geoOrigin, setGeoOrigin] = useState<BrowseOrigin | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      return;
    }

    let cancelled = false;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const next = browseOriginFromGeolocation(
          position.coords.latitude,
          position.coords.longitude,
        );
        writeStoredBrowseOrigin(next);
        setGeoOrigin(next);
        setLocating(false);
      },
      () => {
        if (cancelled) return;
        setGeoOrigin(null);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 10 * 60_000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer live geolocation; when the tenant picks an area chip, bias to that area instead.
  const origin = useMemo(() => {
    if (neighborhoodFilter && neighborhoodFilter !== "All") {
      return fallback;
    }
    return geoOrigin ?? fallback;
  }, [fallback, geoOrigin, neighborhoodFilter]);

  return { origin, locating };
}
