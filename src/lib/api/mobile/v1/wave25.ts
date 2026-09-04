import { mobileError, mobileJson } from "@/lib/api/mobile/v1/auth";
import { parseUuid } from "@/lib/api/mobile/v1/helpers";
import { loadPublicProviderPortfolio } from "@/lib/landlord/public-portfolio";

export async function tryHandleWave25(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const upper = method.toUpperCase();

  if (rest === "/agencies/featured" && upper === "GET") {
    try {
      const { loadFeaturedAgencies } = await import("@/lib/api/homepage.functions");
      const agencies = await loadFeaturedAgencies();
      return mobileJson({ apiVersion: "v1", agencies });
    } catch (err) {
      console.error("[wave25] featured agencies", err);
      return mobileError("Could not load featured agencies", "AGENCIES_ERROR", 500);
    }
  }

  const portfolioMatch = /^\/providers\/([^/]+)\/portfolio$/.exec(rest);
  if (!portfolioMatch || upper !== "GET") return null;

  const providerId = parseUuid(portfolioMatch[1]);
  if (!providerId) return mobileError("Invalid provider id", "VALIDATION", 400);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const portfolio = await loadPublicProviderPortfolio(supabaseAdmin, providerId);
    if (!portfolio) return mobileError("Provider not found", "NOT_FOUND", 404);
    return mobileJson({ apiVersion: "v1", ...portfolio });
  } catch (err) {
    console.error("[wave25] provider portfolio", err);
    return mobileError("Could not load provider portfolio", "PORTFOLIO_ERROR", 500);
  }
}
