import { getSiteUrl } from "@/lib/site";
import { formatKes } from "@/lib/properties";
import type { Property } from "@/lib/properties";
import { appendSocialUtm, buildPropertySocialPackage } from "@/lib/social/content-engine";

export function listingSharePath(propertyId: string): string {
  return `/tenant/property/${propertyId}`;
}

export function listingShareUrl(
  propertyId: string,
  options?: { utmSource?: string; utmCampaign?: string },
): string {
  let base: string;
  if (globalThis.location !== undefined) {
    const origin = globalThis.location.origin;
    if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      base = `${origin.replace(/\/$/, "")}${listingSharePath(propertyId)}`;
    } else {
      base = `${getSiteUrl()}${listingSharePath(propertyId)}`;
    }
  } else {
    base = `${getSiteUrl()}${listingSharePath(propertyId)}`;
  }
  return appendSocialUtm(base, {
    source: options?.utmSource ?? "share",
    campaign: options?.utmCampaign ?? "listing_share",
    content: propertyId.slice(0, 8),
  });
}

export function listingShareText(
  property: Pick<Property, "title" | "neighborhood" | "rent_kes">,
): string {
  const price = property.rent_kes != null ? formatKes(property.rent_kes) : null;
  const bits = [property.title, property.neighborhood, price ? `${price}/mo` : null].filter(
    Boolean,
  );
  return `${bits.join(" · ")} — found on NyumbaSearch`;
}

/** SEO-ready caption for Instagram / TikTok / Reels paste. */
export function listingSocialCaption(
  property: Pick<
    Property,
    | "id"
    | "title"
    | "neighborhood"
    | "rent_kes"
    | "property_type"
    | "bedrooms"
    | "amenities"
    | "is_verified"
  >,
  options?: { utmSource?: string },
): string {
  return buildPropertySocialPackage({
    title: property.title,
    propertyType: property.property_type,
    neighborhood: property.neighborhood,
    bedrooms: property.bedrooms,
    rentKes: property.rent_kes,
    amenities: property.amenities,
    propertyId: property.id,
    isVerified: property.is_verified,
    utmSource: options?.utmSource ?? "share",
    utmCampaign: "listing_share",
  }).caption;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

export async function nativeShareListing(input: {
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  try {
    if (navigator.share !== undefined) {
      await navigator.share({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
  }

  const copied = await copyTextToClipboard(input.url);
  return copied ? "copied" : "failed";
}

export function whatsappShareUrl(url: string, text: string): string {
  const body = `${text}\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(body)}`;
}

export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function twitterShareUrl(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function smsShareUrl(url: string, text: string): string {
  // iOS uses & body; Android often uses ?. Support both via ? which works on modern WebViews.
  const body = `${text}\n${url}`;
  return `sms:?&body=${encodeURIComponent(body)}`;
}

export function emailShareUrl(url: string, title: string, text: string): string {
  const body = `${text}\n\n${url}`;
  return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
