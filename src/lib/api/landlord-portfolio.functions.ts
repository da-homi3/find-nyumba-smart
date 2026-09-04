import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicProviderPortfolio } from "@/lib/landlord/public-portfolio";

export const getPublicProviderPortfolio = createServerFn({ method: "POST" })
  .inputValidator(z.object({ providerId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const portfolio = await loadPublicProviderPortfolio(supabaseAdmin, data.providerId);
    if (!portfolio) throw new Error("Provider not found or has no public listings");
    return portfolio;
  });
