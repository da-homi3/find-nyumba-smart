import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export async function logInboundMessage(
  admin: Admin,
  waPhone: string,
  message: { type?: string; id?: string; text?: { body?: string } },
): Promise<void> {
  const body = message.text?.body ?? JSON.stringify(message).slice(0, 500);
  await admin.from("whatsapp_message_log").insert({
    wa_phone: waPhone,
    direction: "inbound",
    message_type: message.type ?? "text",
    body,
    wa_message_id: message.id ?? null,
    status: "received",
  });
}

export async function logOutboundMessage(
  admin: Admin,
  waPhone: string,
  messageType: string,
  body: string,
): Promise<void> {
  await admin.from("whatsapp_message_log").insert({
    wa_phone: waPhone,
    direction: "outbound",
    message_type: messageType,
    body: body.slice(0, 2000),
    status: "sent",
  });
}

export async function handleStatusUpdate(
  admin: Admin,
  value: Record<string, unknown>,
): Promise<void> {
  const statuses = value.statuses;
  if (!Array.isArray(statuses) || statuses.length === 0) return;
  const status = statuses[0];
  if (!status || typeof status !== "object") return;
  const entry = status as { id?: string; status?: string };
  if (!entry.id || !entry.status) return;
  await admin
    .from("whatsapp_message_log")
    .update({ status: entry.status })
    .eq("wa_message_id", entry.id);
}
