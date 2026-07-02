import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
