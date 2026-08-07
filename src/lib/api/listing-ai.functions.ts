import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { withTimeoutOrThrow } from "@/lib/auth/with-timeout";
import {
  extractAmenitiesFromText,
  polishListingDescriptionAndAmenities,
  suggestNeighborhoodWithNyumbaAI,
} from "@/lib/flows/nyumbaai";
import { formatAmenityString } from "@/lib/listings/amenities";
import {
  resolveSuggestedNeighborhoodLabel,
  suggestNeighborhoodFromCoords,
} from "@/lib/listings/suggest-neighborhood";
import { nearbyKenyaLocations } from "@/lib/geo/location-search";

const ENHANCE_SERVER_TIMEOUT_MS = 28_000;
const EXTRACT_SERVER_TIMEOUT_MS = 18_000;

const imagePartSchema = z.object({
  mimeType: z.string().min(3).max(64),
  base64: z.string().min(32).max(1_500_000),
});

/** HTML number inputs often arrive as strings — coerce safely for AI enhance. */
function optionalCoercedNumber(schema: z.ZodNumber) {
  return z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    return v;
  }, schema.optional());
}

function optionalNullableCoercedNumber() {
  return z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    if (v === null) return null;
    return v;
  }, z.coerce.number().nullable().optional());
}

const listingDraftSchema = z.object({
  title: z.string().max(200).optional(),
  property_type: z.string().max(64).optional(),
  bedrooms: optionalCoercedNumber(z.coerce.number().int().min(0).max(20)),
  bathrooms: optionalCoercedNumber(z.coerce.number().min(0).max(20)),
  neighborhood: z.string().max(120).optional(),
  latitude: optionalNullableCoercedNumber(),
  longitude: optionalNullableCoercedNumber(),
  rent_kes: optionalCoercedNumber(z.coerce.number().min(0)),
  amenities: z.union([z.string().max(1000), z.array(z.string().max(80)).max(60)]).optional(),
});

async function rateLimitAi(userId: string, action: string) {
  const { checkRateLimit, RATE_LIMITS } = await import("@/lib/api/rate-limit");
  checkRateLimit(`listing-ai:${action}:${userId}`, RATE_LIMITS.ai);
}

export const extractListingAmenities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      description: z.string().trim().min(8).max(8000),
      existingAmenities: z
        .union([z.string().max(1000), z.array(z.string().max(80)).max(60)])
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    await rateLimitAi(userId, "extract");

    const amenities = await withTimeoutOrThrow(
      extractAmenitiesFromText(data.description, data.existingAmenities),
      EXTRACT_SERVER_TIMEOUT_MS,
      "Amenity extraction timed out. Try again in a moment.",
    );
    return {
      amenities,
      amenitiesCsv: formatAmenityString(amenities),
    };
  });

/** Polish description + extract every amenity in one server call. */
export const enhanceListingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      description: z.string().trim().min(20).max(8000),
      draft: listingDraftSchema.optional(),
      imageDataUrls: z.array(imagePartSchema).max(3).optional(),
      existingAmenities: z
        .union([z.string().max(1000), z.array(z.string().max(80)).max(60)])
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    await rateLimitAi(userId, "enhance");

    const draft = data.draft ?? {};
    const existing =
      data.existingAmenities ??
      (typeof draft.amenities === "string" || Array.isArray(draft.amenities)
        ? draft.amenities
        : undefined);

    const polished = await withTimeoutOrThrow(
      polishListingDescriptionAndAmenities(
        data.description,
        draft,
        data.imageDataUrls ?? [],
        existing,
      ),
      ENHANCE_SERVER_TIMEOUT_MS,
      "AI enhance timed out. Try again in a moment.",
    );

    return {
      description: polished.description,
      amenities: polished.amenities,
      amenitiesCsv: formatAmenityString(polished.amenities),
    };
  });

/** Auto-detect listing neighborhood from pin / address via catalog + NyumbaAI. */
export const suggestListingNeighborhood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      latitude: optionalNullableCoercedNumber(),
      longitude: optionalNullableCoercedNumber(),
      address: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    await rateLimitAi(userId, "neighborhood");

    const lat = data.latitude ?? null;
    const lng = data.longitude ?? null;
    const local = lat != null && lng != null ? suggestNeighborhoodFromCoords(lat, lng) : null;

    const candidates = [
      ...(local ? [local.neighborhood, ...local.alternatives] : []),
      ...(lat != null && lng != null
        ? nearbyKenyaLocations(lat, lng, { limit: 6, maxKm: 20 })
            .map((n) => n.neighborhood)
            .filter((v): v is string => Boolean(v))
        : []),
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    // High-confidence catalog hit: skip AI for speed.
    if (local && local.confidence === "high") {
      return {
        neighborhood: local.neighborhood,
        source: local.source,
        confidence: local.confidence,
        alternatives: local.alternatives,
      };
    }

    const aiRaw = await withTimeoutOrThrow(
      suggestNeighborhoodWithNyumbaAI({
        lat,
        lng,
        address: data.address,
        candidates: candidates.length > 0 ? candidates : undefined,
      }),
      EXTRACT_SERVER_TIMEOUT_MS,
      "Neighborhood suggestion timed out. Try again in a moment.",
    );

    const aiNeighborhood = aiRaw ? resolveSuggestedNeighborhoodLabel(aiRaw) : null;
    if (aiNeighborhood) {
      return {
        neighborhood: aiNeighborhood,
        source: "ai" as const,
        confidence: local?.confidence ?? "medium",
        alternatives: local?.alternatives ?? [],
      };
    }

    if (local) {
      return {
        neighborhood: local.neighborhood,
        source: local.source,
        confidence: local.confidence,
        alternatives: local.alternatives,
      };
    }

    return {
      neighborhood: null as string | null,
      source: "none" as const,
      confidence: "low" as const,
      alternatives: [] as string[],
    };
  });
