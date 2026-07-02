import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isWhatsAppConfigured, whatsappApiVersion, whatsappPhoneId, whatsappToken } from "@/lib/whatsapp/env";

type Admin = SupabaseClient<Database>;

function apiBase(): string {
  const phoneId = whatsappPhoneId();
  if (!phoneId) throw new Error("WHATSAPP_PHONE_ID not configured");
  return `https://graph.facebook.com/${whatsappApiVersion()}/${phoneId}/messages`;
}

async function post(body: object): Promise<unknown> {
  const token = whatsappToken();
  if (!token) throw new Error("WHATSAPP_TOKEN not configured");

  const res = await fetch(apiBase(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("WhatsApp API error:", err);
  }
  return res.json().catch(() => ({}));
}

export async function sendText(to: string, text: string, admin?: Admin): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  await post({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  });
  if (admin) {
    const { logOutboundMessage } = await import("@/lib/whatsapp/log");
    await logOutboundMessage(admin, to, "text", text);
  }
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: { id: string; label: string }[],
  admin?: Admin,
): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  await post({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.label.slice(0, 20) },
        })),
      },
    },
  });
  if (admin) {
    const { logOutboundMessage } = await import("@/lib/whatsapp/log");
    await logOutboundMessage(admin, to, "interactive", body);
  }
}

export async function sendList(
  to: string,
  body: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  admin?: Admin,
): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  await post({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description?.slice(0, 72) ?? "",
          })),
        })),
      },
    },
  });
  if (admin) {
    const { logOutboundMessage } = await import("@/lib/whatsapp/log");
    await logOutboundMessage(admin, to, "interactive", body);
  }
}

export async function sendImage(
  to: string,
  imageUrl: string,
  caption: string,
  admin?: Admin,
): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  await post({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: imageUrl, caption: caption.slice(0, 1024) },
  });
  if (admin) {
    const { logOutboundMessage } = await import("@/lib/whatsapp/log");
    await logOutboundMessage(admin, to, "image", caption);
  }
}

export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode = "en",
  components: object[] = [],
): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  await post({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components },
  });
}

export async function markRead(messageId: string): Promise<void> {
  if (!isWhatsAppConfigured() || !messageId) return;
  await post({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

export async function downloadMedia(mediaId: string): Promise<ArrayBuffer> {
  const token = whatsappToken();
  if (!token) throw new Error("WHATSAPP_TOKEN not configured");

  const urlRes = await fetch(
    `https://graph.facebook.com/${whatsappApiVersion()}/${mediaId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const urlJson: { url?: string } = await urlRes.json();
  if (!urlJson.url) throw new Error("WhatsApp media URL missing");

  const mediaRes = await fetch(urlJson.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!mediaRes.ok) throw new Error(`WhatsApp media download failed: ${mediaRes.status}`);
  return mediaRes.arrayBuffer();
}

/** Legacy single-text reply helper. */
export async function sendWhatsAppReply(phone: string, text: string): Promise<void> {
  await sendText(phone, text);
}
