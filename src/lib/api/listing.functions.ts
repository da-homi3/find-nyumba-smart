import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchProperty } from "@/lib/properties";
import {
  computeListingRiskScore,
  neighborhoodMedianRent,
} from "@/lib/listings/risk-score";

export const getListingRiskScore = createServerFn({ method: "GET" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const property = await fetchProperty(data.listingId);
    if (!property) {
      throw new Error("Listing not found");
    }

    const { listProperties } = await import("@/lib/api/nyumba.functions");
    const { items } = await listProperties({ data: { limit: 200 } });
    const median = neighborhoodMedianRent(property.neighborhood, items);

    return computeListingRiskScore(property, median);
  });
