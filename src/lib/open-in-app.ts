import { PLAY_STORE_URL } from "@/components/AppDownloadBanner";

export const ANDROID_PACKAGE_ID = "ke.co.nyumbasearch.app";

/** True for phones/tablets where App Links / Intent redirects make sense. */
export function isMobileInviteClient(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

export function isAndroidClient(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/**
 * Android Intent URL that opens the installed app for an https App Link path.
 * Falls back to Play Store (or the same https URL) if the app is missing.
 */
export function androidAppIntentUrl(httpsUrl: string, fallbackUrl = PLAY_STORE_URL): string {
  const url = new URL(httpsUrl);
  const host = url.host;
  const pathAndQuery = `${url.pathname}${url.search}${url.hash}`;
  const fallback = encodeURIComponent(fallbackUrl);
  return `intent://${host}${pathAndQuery}#Intent;scheme=https;package=${ANDROID_PACKAGE_ID};S.browser_fallback_url=${fallback};end`;
}

/** Absolute https URL for the current invite path (SSR-safe when given window origin). */
export function absoluteInviteHttpsUrl(pathname: string, origin?: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  if (typeof globalThis.location?.origin === "string") {
    return `${globalThis.location.origin}${path}`;
  }
  return `https://nyumbasearch.com${path}`;
}
