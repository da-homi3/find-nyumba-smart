/** Structured AI usage log. Does not store prompts (PII / cost control). */
export function logAiUsage(input: {
  userId: string;
  feature: string;
  ok: boolean;
}): void {
  console.info(
    "[NyumbaSearch:ai]",
    JSON.stringify({
      user: input.userId,
      feature: input.feature,
      ok: input.ok,
      at: new Date().toISOString(),
    }),
  );
  void persistAiUsage(input);
}

async function persistAiUsage(input: {
  userId: string;
  feature: string;
  ok: boolean;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { error } = await asLooseDb(supabaseAdmin).from("ai_usage_events").insert({
      user_id: input.userId,
      feature: input.feature,
      ok: input.ok,
    });
    if (error) console.warn("[NyumbaSearch:ai] persist:", error.message);
  } catch (err) {
    console.warn("[NyumbaSearch:ai] persist:", err);
  }
}
