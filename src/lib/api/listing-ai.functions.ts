import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import {
  enhanceListingCopyWithImages,
  extractAmenitiesFromText,
} from "@/lib/flows/nyumbaai";
import { formatAmenityString } from "@/lib/listings/amenities";

const imagePartSchema = z.object({
  mimeType: z.string().min(3).max(64),
  base64: z.string().min(32).max(1_500_000),
});

const listingDraftSchema = z.object({
  title: z.string().max(200).optional(),
  property_type: z.string().max(64).optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().min(0).max(20).optional(),
  neighborhood: z.string().max(120).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  rent_kes: z.number().min(0).optional(),
  amenities: z.union([z.string().max(1000), z.array(z.string().max(80)).max(30)]).optional(),
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
        .union([z.string().max(1000), z.array(z.string().max(80)).max(30)])
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    await rateLimitAi(userId, "extract");

    const amenities = await extractAmenitiesFromText(data.description, data.existingAmenities);
    return {
      amenities,
      amenitiesCsv: formatAmenityString(amenities),
    };
  });

export const enhanceListingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      description: z.string().trim().min(20).max(8000),
      draft: listingDraftSchema.optional(),
      imageDataUrls: z.array(imagePartSchema).max(3).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    await rateLimitAi(userId, "enhance");

    const draft = data.draft ?? {};

    const enhanced = await enhanceListingCopyWithImages(
      data.description,
      draft,
      data.imageDataUrls ?? [],
    );

    return { description: enhanced };
  });
