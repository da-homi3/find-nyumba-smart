import { createServerFn } from "@tanstack/react-start";
import { createPublicClient } from "@/lib/api/public-client";

export type PublicStats = {
  activeListings: number;
  verifiedListings: number;
  neighborhoodCount: number;
  totalViews: number;
};

export const getPublicStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStats> => {
    const supabase = createPublicClient();

    const [activeRes, verifiedRes, hoodRes] = await Promise.all([
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_verified", true),
      supabase.from("properties").select("neighborhood").eq("is_active", true).limit(500),
    ]);

    const neighborhoods = new Set((hoodRes.data ?? []).map((r) => r.neighborhood));
    const viewsRes = await supabase
      .from("properties")
      .select("views")
      .eq("is_active", true)
      .limit(500);

    const totalViews = (viewsRes.data ?? []).reduce((sum, r) => sum + (r.views ?? 0), 0);

    return {
      activeListings: activeRes.count ?? 0,
      verifiedListings: verifiedRes.count ?? 0,
      neighborhoodCount: neighborhoods.size,
      totalViews,
    };
  },
);
