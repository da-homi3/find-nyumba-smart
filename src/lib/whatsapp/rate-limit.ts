import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/** Returns true when rate limit exceeded (max messages per window). */
export async function checkWhatsAppRateLimit(
  admin: Admin,
  waPhone: string,
  max = 30,
  windowSeconds = 60,
): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await admin
    .from("whatsapp_message_log")
    .select("id", { count: "exact", head: true })
    .eq("wa_phone", waPhone)
    .eq("direction", "inbound")
    .gte("created_at", since);

  if (error) return false;
  return (count ?? 0) >= max;
}
