import { getSiteUrl } from "@/lib/site";
import { formatKes } from "@/lib/properties";
import type { Property } from "@/lib/properties";

export function listingSharePath(propertyId: string): string {
  return `/tenant/property/${propertyId}`;
}

export function listingShareUrl(propertyId: string): string {
  if (typeof globalThis.location !== "undefined") {
    const origin = globalThis.location.origin;
    if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return `${origin.replace(/\/$/, "")}${listingSharePath(propertyId)}`;
    }
  }
  return `${getSiteUrl()}${listingSharePath(propertyId)}`;
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

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function nativeShareListing(input: {
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
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
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
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
  return `sms:?&body=${encodeURIComponent(`${text}\n${url}`)}`;
}

export function emailShareUrl(url: string, title: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
}
