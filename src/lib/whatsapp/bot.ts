import type { WaInboundMessage } from "@/lib/whatsapp/types";
import { whatsappVerifyToken } from "@/lib/whatsapp/env";

export { sendWhatsAppReply } from "@/lib/whatsapp/client";
export { handleWhatsAppWebhookRequest } from "@/lib/whatsapp/webhook";

export function verifyWhatsAppWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): string | null {
  if (mode === "subscribe" && token === whatsappVerifyToken() && challenge) {
    return challenge;
  }
  return null;
}

function extractText(message: Record<string, unknown>): string {
  const text = message.text as { body?: string } | undefined;
  return text?.body?.trim() ?? "";
}

function extractInteractiveId(message: Record<string, unknown>): string {
  const interactive = message.interactive as
    | { button_reply?: { id?: string }; list_reply?: { id?: string } }
    | undefined;
  return interactive?.button_reply?.id ?? interactive?.list_reply?.id ?? "";
}

function coerceWebhookString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

/** Parse Meta webhook payload into normalized inbound messages. */
export function parseWhatsAppWebhook(body: unknown): WaInboundMessage[] {
  const payload = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<Record<string, unknown>>;
          contacts?: Array<{ profile?: { name?: string } }>;
        };
      }>;
    }>;
  };

  const messages: WaInboundMessage[] = [];
  const entry = payload?.entry?.[0];
  const value = entry?.changes?.[0]?.value;
  if (!value?.messages?.length) return messages;

  const contact = value.contacts?.[0];
  const senderName = contact?.profile?.name ?? "there";

  for (const msg of value.messages) {
    const phone = coerceWebhookString(msg.from, "");
    if (!phone) continue;

    const location = msg.location as { latitude?: number; longitude?: number } | undefined;
    const image = msg.image as { id?: string } | undefined;

    messages.push({
      id: msg.id as string | undefined,
      phone,
      senderName,
      type: coerceWebhookString(msg.type, "text"),
      text: extractText(msg),
      interactiveId: extractInteractiveId(msg),
      location:
        location?.latitude != null && location?.longitude != null
          ? { latitude: location.latitude, longitude: location.longitude }
          : undefined,
      imageId: image?.id,
      raw: msg,
    });
  }

  return messages;
}

/** @deprecated Use routeMessage via webhook handler. Kept for backward compatibility. */
export async function handleWhatsAppInbound(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  phone: string,
  text: string,
): Promise<string> {
  const { routeMessage } = await import("@/lib/flows/router");
  const msg: WaInboundMessage = {
    phone,
    senderName: "there",
    type: "text",
    text,
    interactiveId: "",
    raw: {},
  };
  await routeMessage(supabaseAdmin, phone, "there", msg);
  return "";
}
