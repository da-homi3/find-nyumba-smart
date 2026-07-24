import {
  apilayerFetchJson,
  asNumber,
  asRecord,
  asString,
  isProductConfigured,
  resolveProductAuth,
} from "@/lib/apilayer/client";
import { cacheGet, cacheSet } from "@/lib/cache/manager";

const ADDRESS_CACHE_TTL_SEC = 14 * 24 * 60 * 60;

export type StreetlayerResult = {
  configured: boolean;
  available: boolean;
  validationStatus: "verified" | "unsure" | "invalid" | "skipped" | "unavailable";
  formatted: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ListingAddressInput = {
  address?: string | null;
  neighborhood: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type ListingAddressEnrichment = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  addressQuality: StreetlayerResult["validationStatus"];
};

function normalizeStatus(raw: string | null): StreetlayerResult["validationStatus"] {
  const value = (raw ?? "").toLowerCase();
  if (value === "verified" || value === "valid") return "verified";
  if (value === "invalid" || value === "failed") return "invalid";
  if (value === "unsure" || value === "partial") return "unsure";
  return "unavailable";
}

export async function validateStreetAddress(input: {
  address1: string;
  locality?: string;
  countryCode?: string;
}): Promise<StreetlayerResult> {
  const address1 = input.address1.trim();
  const locality = input.locality?.trim() || "";
  const countryCode = (input.countryCode ?? "KE").toUpperCase();

  const base: StreetlayerResult = {
    configured: false,
    available: false,
    validationStatus: "skipped",
    formatted: null,
    latitude: null,
    longitude: null,
  };

  if (address1.length < 5) return base;

  const auth = resolveProductAuth("streetlayer");
  if (!auth) return base;

  const cacheKey = `apilayer:street:${countryCode}:${locality}:${address1}`.toLowerCase();
  const cached = await cacheGet<StreetlayerResult>(cacheKey);
  if (cached?.available) return cached;

  const params = new URLSearchParams({
    address1,
    country_code: countryCode,
  });
  if (locality) params.set("locality", locality);

  let json: unknown = null;
  if (auth.mode === "header") {
    const paths = [
      `https://api.apilayer.com/streetlayer/validate?${params}`,
      `https://api.apilayer.com/address_verification/validate?${params}`,
    ];
    for (const url of paths) {
      json = await apilayerFetchJson(url, { apikey: auth.key });
      const row = asRecord(json);
      if (row && row.success !== false && (row.validation_status != null || row.latitude != null)) {
        break;
      }
      json = null;
    }
  } else {
    params.set("access_key", auth.key);
    json = await apilayerFetchJson(`https://apilayer.net/api/validate?${params}`);
  }

  const row = asRecord(json);
  if (!row || row.success === false) {
    console.warn("[streetlayer] unavailable or error", row?.error ?? null);
    return { ...base, configured: true, available: false, validationStatus: "unavailable" };
  }

  const geo = asRecord(row.coordinates) ?? row;
  const result: StreetlayerResult = {
    configured: true,
    available: true,
    validationStatus: normalizeStatus(asString(row.validation_status)),
    formatted: asString(row.formatted_address) ?? asString(row.address) ?? address1,
    latitude: asNumber(geo.latitude) ?? asNumber(row.latitude),
    longitude: asNumber(geo.longitude) ?? asNumber(row.longitude),
  };

  await cacheSet(cacheKey, result, { kvTtl: ADDRESS_CACHE_TTL_SEC });
  return result;
}

/**
 * Improve listing pin/coords from streetlayer when the landlord typed an address.
 * Never blocks publish — Mapbox/Google remain the primary geospatial stack.
 */
export async function enrichListingAddress(
  input: ListingAddressInput,
): Promise<ListingAddressEnrichment> {
  const address = input.address?.trim() || null;
  let latitude = input.latitude ?? null;
  let longitude = input.longitude ?? null;

  if (!address || !isProductConfigured("streetlayer")) {
    return { address, latitude, longitude, addressQuality: "skipped" };
  }

  const result = await validateStreetAddress({
    address1: address,
    locality: input.neighborhood,
    countryCode: "KE",
  });

  if (!result.available) {
    return { address, latitude, longitude, addressQuality: "unavailable" };
  }

  // Fill missing map pins from a verified/unsure geocode; never overwrite an explicit pin.
  if ((latitude == null || longitude == null) && result.latitude != null && result.longitude != null) {
    latitude = result.latitude;
    longitude = result.longitude;
  }

  return {
    address: result.formatted ?? address,
    latitude,
    longitude,
    addressQuality: result.validationStatus,
  };
}
