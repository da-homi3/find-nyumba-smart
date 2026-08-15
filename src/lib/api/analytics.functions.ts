import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";

const searchEventSchema = z.object({
  query: z.string().max(200).optional(),
  neighborhood: z.string().max(80).optional(),
  resultCount: z.number().int().min(0).max(10_000),
  sessionId: z.string().max(64).optional(),
  userId: z.string().uuid().optional(),
});

/** Fire-and-forget search analytics (structured log + search_events row). */
export const recordSearchEvent = createServerFn({ method: "POST" })
  .inputValidator(searchEventSchema)
  .handler(async ({ data }) => {
    const payload = {
      type: "search",
      query: data.query ?? "",
      neighborhood: data.neighborhood ?? "",
      resultCount: data.resultCount,
      sessionId: data.sessionId ?? "anonymous",
      userId: data.userId ?? null,
      at: new Date().toISOString(),
    };
    console.info("[NyumbaSearch:analytics]", JSON.stringify(payload));

    try {
      await supabaseAdmin.from("search_events").insert({
        user_id: data.userId ?? null,
        query: data.query ?? null,
        neighborhood: data.neighborhood ?? null,
        result_count: data.resultCount,
        session_id: data.sessionId ?? null,
      });
    } catch (err) {
      console.warn("[analytics] search_events insert:", err);
    }

    return { recorded: true };
  });

export const recordProductEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      eventName: z.string().min(3).max(80),
      properties: z.record(z.unknown()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { recordProductEventCore } = await import("@/lib/analytics/product-events");
    await recordProductEventCore(userId, data.eventName, data.properties ?? {});
    return { recorded: true };
  });
