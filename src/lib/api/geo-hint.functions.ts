import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { checkRateLimit, rateLimitKeyFromHeaders, RATE_LIMITS } from "@/lib/api/rate-limit";

/** IP → Kenya area hint for smarter tenant defaults (ipstack). */
export const getClientAreaHint = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const ip = rateLimitKeyFromHeaders(request?.headers);
  checkRateLimit(`ipstack:${ip}`, RATE_LIMITS.ai);

  const { resolveAreaHintFromIp } = await import("@/lib/apilayer/ipstack");
  const hint = await resolveAreaHintFromIp(ip);

  return {
    available: hint.available,
    countryCode: hint.countryCode,
    county: hint.county,
    neighborhood: hint.neighborhood,
    filterValue: hint.filterValue,
    lat: hint.lat,
    lng: hint.lng,
    fraudRisk: hint.fraudRisk,
  };
});
