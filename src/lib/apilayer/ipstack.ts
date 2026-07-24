import {
  apilayerFetchJson,
  asBool,
  asNumber,
  asRecord,
  asString,
  isProductConfigured,
  resolveProductAuth,
} from "@/lib/apilayer/client";
import { cacheGet, cacheSet } from "@/lib/cache/manager";
import {
  KENYA_COUNTIES,
  countyWideFilterValue,
  matchLocation,
  neighborhoodStorageValue,
} from "@/data/kenya-locations";
import { neighborhoodCentroid } from "@/lib/geo/property-map-coords";

const IP_CACHE_TTL_SEC = 6 * 60 * 60;

export type IpstackLookup = {
  configured: boolean;
  available: boolean;
  ip: string;
  countryCode: string | null;
  countryName: string | null;
  regionName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isProxy: boolean;
  isTor: boolean;
};

export type KenyaAreaHint = {
  configured: boolean;
  available: boolean;
  ip: string;
  countryCode: string | null;
  county: string | null;
  neighborhood: string | null;
  /** Tenant filter chip value (`Kilimani` or `All Kiambu`). */
  filterValue: string | null;
  lat: number | null;
  lng: number | null;
  fraudRisk: "low" | "elevated";
  countryMismatchLikely: boolean;
};

function emptyLookup(ip: string): IpstackLookup {
  return {
    configured: false,
    available: false,
    ip,
    countryCode: null,
    countryName: null,
    regionName: null,
    city: null,
    latitude: null,
    longitude: null,
    isProxy: false,
    isTor: false,
  };
}

export async function lookupIpstack(ip: string): Promise<IpstackLookup> {
  const cleaned = ip.trim();
  const base = emptyLookup(cleaned);
  if (!cleaned || cleaned === "anonymous" || cleaned === "127.0.0.1" || cleaned === "::1") {
    return base;
  }

  const auth = resolveProductAuth("ipstack");
  if (!auth) return base;

  const cacheKey = `apilayer:ip:${cleaned}`;
  const cached = await cacheGet<IpstackLookup>(cacheKey);
  if (cached?.available) return cached;

  let json: unknown = null;
  if (auth.mode === "header") {
    const paths = [
      `https://api.apilayer.com/ip_to_location/${encodeURIComponent(cleaned)}`,
      `https://api.apilayer.com/ipstack/${encodeURIComponent(cleaned)}`,
    ];
    for (const url of paths) {
      json = await apilayerFetchJson(url, { apikey: auth.key });
      const row = asRecord(json);
      if (row && row.success !== false && (row.country_code != null || row.ip != null)) break;
      json = null;
    }
  } else {
    const url =
      `https://api.ipstack.com/${encodeURIComponent(cleaned)}` +
      `?access_key=${encodeURIComponent(auth.key)}&security=1`;
    json = await apilayerFetchJson(url);
  }

  const row = asRecord(json);
  if (!row || row.success === false) {
    console.warn("[ipstack] unavailable or error", row?.error ?? null);
    return { ...base, configured: true, available: false };
  }

  const security = asRecord(row.security);
  const result: IpstackLookup = {
    configured: true,
    available: true,
    ip: asString(row.ip) ?? cleaned,
    countryCode: asString(row.country_code)?.toUpperCase() ?? null,
    countryName: asString(row.country_name),
    regionName: asString(row.region_name),
    city: asString(row.city),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    isProxy: asBool(security?.is_proxy) ?? asBool(row.is_proxy) ?? false,
    isTor: asBool(security?.is_tor) ?? asBool(row.is_tor) ?? false,
  };

  await cacheSet(cacheKey, result, { kvTtl: IP_CACHE_TTL_SEC });
  return result;
}

/** Map an ipstack city/region onto NyumbaSearch Kenya location catalog. */
export function mapIpstackToKenyaArea(lookup: IpstackLookup): Omit<
  KenyaAreaHint,
  "configured" | "available" | "ip" | "fraudRisk" | "countryMismatchLikely"
> {
  const empty = {
    countryCode: lookup.countryCode,
    county: null as string | null,
    neighborhood: null as string | null,
    filterValue: null as string | null,
    lat: lookup.latitude,
    lng: lookup.longitude,
  };

  if (lookup.countryCode && lookup.countryCode !== "KE") return empty;

  const candidates = [lookup.city, lookup.regionName].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const matched = matchLocation(candidate);
    if (matched) {
      return {
        countryCode: "KE",
        county: matched.county,
        neighborhood: neighborhoodStorageValue(matched),
        filterValue:
          matched.county === "Nairobi"
            ? matched.name
            : countyWideFilterValue(matched.county),
        lat: matched.lat,
        lng: matched.lng,
      };
    }
  }

  for (const candidate of candidates) {
    const county = KENYA_COUNTIES.find((c) => c.toLowerCase() === candidate.toLowerCase());
    if (!county) continue;
    const centroid = neighborhoodCentroid(county) ?? neighborhoodCentroid(`All ${county}`);
    return {
      countryCode: "KE",
      county,
      neighborhood: null,
      filterValue: countyWideFilterValue(county),
      lat: centroid?.lat ?? lookup.latitude,
      lng: centroid?.lng ?? lookup.longitude,
    };
  }

  return {
    ...empty,
    countryCode: lookup.countryCode ?? (lookup.available ? "KE" : null),
  };
}

export function buildKenyaAreaHint(lookup: IpstackLookup): KenyaAreaHint {
  const mapped = mapIpstackToKenyaArea(lookup);
  const fraudRisk: KenyaAreaHint["fraudRisk"] =
    lookup.isProxy || lookup.isTor ? "elevated" : "low";
  return {
    configured: lookup.configured,
    available: lookup.available,
    ip: lookup.ip,
    ...mapped,
    fraudRisk,
    countryMismatchLikely: Boolean(lookup.countryCode && lookup.countryCode !== "KE"),
  };
}

export async function resolveAreaHintFromIp(ip: string): Promise<KenyaAreaHint> {
  if (!isProductConfigured("ipstack")) {
    return {
      configured: false,
      available: false,
      ip,
      countryCode: null,
      county: null,
      neighborhood: null,
      filterValue: null,
      lat: null,
      lng: null,
      fraudRisk: "low",
      countryMismatchLikely: false,
    };
  }
  const lookup = await lookupIpstack(ip);
  return buildKenyaAreaHint(lookup);
}
