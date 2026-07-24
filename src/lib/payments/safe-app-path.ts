/** Relative in-app paths only — blocks open redirects after card checkout. */
export function sanitizeAppPath(path: string, fallback: string): string {
  const raw = (path || "").trim();
  if (!raw) return fallback;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("//")) {
    return fallback;
  }
  if (raw.includes("\\") || raw.includes("@")) return fallback;
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  if (normalized.startsWith("//")) return fallback;
  return normalized;
}
