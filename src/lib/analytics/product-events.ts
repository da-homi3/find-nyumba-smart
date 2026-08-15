export async function recordProductEventCore(
  userId: string | null,
  eventName: string,
  properties: Record<string, unknown> = {},
) {
  const payload = {
    type: eventName,
    userId,
    properties,
    at: new Date().toISOString(),
  };
  console.info("[NyumbaSearch:product]", JSON.stringify(payload));
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    await asLooseDb(supabaseAdmin).from("product_events").insert({
      user_id: userId,
      event_name: eventName,
      properties,
    });
  } catch (err) {
    console.warn("[analytics] product_events insert:", err);
  }
}
