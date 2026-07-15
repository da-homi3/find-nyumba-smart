/** Extract a property-media storage object path from a signed/public URL or raw path. */
export function propertyMediaPathFromUrl(urlOrPath: string): string | null {
  const raw = urlOrPath.trim();
  if (!raw) return null;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i.test(raw)) {
    return raw.split("?")[0] ?? raw;
  }

  try {
    const u = new URL(raw);
    const markers = [
      "/object/sign/property-media/",
      "/object/public/property-media/",
      "/object/authenticated/property-media/",
    ];
    for (const marker of markers) {
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(u.pathname.slice(idx + marker.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function filenameFromMediaPath(path: string, fallback: string): string {
  const base = path.split("/").pop() ?? fallback;
  return base.split("?")[0] || fallback;
}
