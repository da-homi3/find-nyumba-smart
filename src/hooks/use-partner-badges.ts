import { useQuery } from "@tanstack/react-query";
import { getPartnerBadgeForProperties } from "@/lib/api/pilot-partnership.functions";

/** Batch-fetch Official Partner badges for listing cards. */
export function usePartnerBadges(propertyIds: string[]) {
  const key = propertyIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["partner-badges", key],
    enabled: propertyIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => getPartnerBadgeForProperties({ data: { propertyIds } }),
  });
}
