import { verifyWebhookSignature } from "@/lib/whatsapp/signature";
import { whatsappAppSecret, whatsappVerifyToken } from "@/lib/whatsapp/env";
import { parseWhatsAppWebhook } from "@/lib/whatsapp/bot";
import { routeMessage } from "@/lib/flows/router";
import { checkWhatsAppRateLimit } from "@/lib/whatsapp/rate-limit";
import { handleStatusUpdate, logInboundMessage } from "@/lib/whatsapp/log";
import { sendText } from "@/lib/whatsapp/client";

export async function handleWhatsAppWebhookRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === whatsappVerifyToken() && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await request.text();
  const appSecret = whatsappAppSecret();

  if (appSecret) {
    const sigHeader = request.headers.get("x-hub-signature-256") ?? "";
    const valid = await verifyWebhookSignature(rawBody, sigHeader, appSecret);
    if (!valid) {
      console.error("WhatsApp webhook: invalid signature");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const payload = body as {
    entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }>;
  };
  const value = payload?.entry?.[0]?.changes?.[0]?.value;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!value?.messages) {
    if (value) await handleStatusUpdate(supabaseAdmin, value);
    return new Response("OK", { status: 200 });
  }

  const messages = parseWhatsAppWebhook(body);

  for (const msg of messages) {
    await logInboundMessage(supabaseAdmin, msg.phone, {
      type: msg.type,
      id: msg.id,
      text: { body: msg.text || msg.interactiveId },
    });

    const limited = await checkWhatsAppRateLimit(supabaseAdmin, msg.phone);
    if (limited) {
      await sendText(msg.phone, "You're sending messages too fast. Please wait a moment. ⏳", supabaseAdmin);
      continue;
    }

    routeMessage(supabaseAdmin, msg.phone, msg.senderName, msg).catch((err) => {
      console.error("WhatsApp route error:", err);
    });
  }

  return new Response("OK", { status: 200 });
}
