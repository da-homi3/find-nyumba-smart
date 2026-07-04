import { BRAND_ICON_PATH, BRAND_LOGO_PATH } from "@/lib/brand";

export const DEFAULT_SITE_URL = "https://nyumbasearch.com";

/** Public customer care — help, assistance, and inquiries */
export const CUSTOMER_CARE_EMAIL = "nyumbasearch101@gmail.com";
export const CUSTOMER_CARE_PHONE = "0768314076";
export const CUSTOMER_CARE_PHONE_E164 = "+254768314076";

export function customerCareMailtoHref(subject?: string): string {
  const base = `mailto:${CUSTOMER_CARE_EMAIL}`;
  if (!subject?.trim()) return base;
  return `${base}?subject=${encodeURIComponent(subject.trim())}`;
}

export function customerCareTelHref(): string {
  return `tel:${CUSTOMER_CARE_PHONE_E164}`;
}

/** Shared homepage title — keep `<title>`, `og:title`, and `twitter:title` identical. */
export const HOMEPAGE_TITLE = "NyumbaSearch — Verified Homes in Nairobi | No Agents";

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

export function getBrandLogoUrl(): string {
  return `${getSiteUrl()}${BRAND_LOGO_PATH}`;
}

export function getBrandIconUrl(): string {
  return `${getSiteUrl()}${BRAND_ICON_PATH}`;
}
