export const DEFAULT_SITE_URL = "https://nyumba-search.kevinbuluma1.workers.dev";

/** Canonical public site URL (SSR + client). */
export function getSiteUrl(): string {
  if (typeof process !== "undefined" && process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const viteUrl = import.meta.env.VITE_SITE_URL as string | undefined;
  if (viteUrl) return viteUrl.replace(/\/$/, "");
  return DEFAULT_SITE_URL;
}

export function getOgImageUrl(): string {
  return `${getSiteUrl()}/og-image.jpg`;
}
