import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const searchEventSchema = z.object({
  query: z.string().max(200).optional(),
  neighborhood: z.string().max(80).optional(),
  resultCount: z.number().int().min(0).max(10_000),
  sessionId: z.string().max(64).optional(),
});

/** Fire-and-forget search analytics (structured server log + optional DB row). */
export const recordSearchEvent = createServerFn({ method: "POST" })
  .inputValidator(searchEventSchema)
  .handler(async ({ data }) => {
    const payload = {
      type: "search",
      query: data.query ?? "",
      neighborhood: data.neighborhood ?? "",
      resultCount: data.resultCount,
      sessionId: data.sessionId ?? "anonymous",
      at: new Date().toISOString(),
    };
    console.info("[NyumbaSearch:analytics]", JSON.stringify(payload));

    try {
      await supabaseAdmin.from("admin_audit_logs").insert({
        action: "search_event",
        details: JSON.stringify(payload),
      });
    } catch {
      /* non-blocking */
    }
    return { recorded: true };
  });
