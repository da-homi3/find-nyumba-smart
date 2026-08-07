import { toWhatsAppDigits } from "@/lib/phone";

export type SendSmsResult = {
  ok: true;
  messageId?: string;
};

/**
 * Send an SMS via Africa’s Talking.
 * Env: AT_USERNAME, AT_API_KEY, optional AT_SENDER_ID, optional AT_ENV=sandbox|production
 */
export async function sendSmsViaAfricasTalking(opts: {
  to: string;
  message: string;
}): Promise<SendSmsResult> {
  const username = process.env.AT_USERNAME?.trim();
  const apiKey = process.env.AT_API_KEY?.trim();
  const senderId = process.env.AT_SENDER_ID?.trim();
  const envFlag = (process.env.AT_ENV ?? "").trim().toLowerCase();

  if (!username || !apiKey) {
    throw new Error(
      "SMS is not configured. Add AT_USERNAME and AT_API_KEY to enable phone signup.",
    );
  }

  const to254 = toWhatsAppDigits(opts.to);
  if (!to254) {
    throw new Error("Invalid Kenyan mobile number for SMS");
  }

  const useSandbox = envFlag === "sandbox" || username.toLowerCase() === "sandbox";
  const endpoint = useSandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const body = new URLSearchParams();
  body.set("username", username);
  body.set("to", `+${to254}`);
  body.set("message", opts.message.slice(0, 480));
  if (senderId) body.set("from", senderId);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey,
    },
    body,
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // non-JSON error body
  }

  if (!res.ok) {
    console.error("[at-sms] HTTP", res.status, text.slice(0, 400));
    throw new Error("Could not send SMS. Try again in a moment.");
  }

  const recipients =
    parsed &&
    typeof parsed === "object" &&
    "SMSMessageData" in parsed &&
    parsed.SMSMessageData &&
    typeof parsed.SMSMessageData === "object" &&
    "Recipients" in parsed.SMSMessageData
      ? (
          parsed.SMSMessageData as {
            Recipients?: Array<{ statusCode?: number; messageId?: string; status?: string }>;
          }
        ).Recipients
      : undefined;

  const first = recipients?.[0];
  // AT statusCode 101 = Success, 100 = Processed
  if (first && typeof first.statusCode === "number" && first.statusCode >= 400) {
    console.error("[at-sms] recipient failed", first);
    throw new Error(first.status ?? "SMS delivery failed for this number.");
  }

  return { ok: true, messageId: first?.messageId };
}

export function phoneSignupOtpMessage(code: string): string {
  return `Your NyumbaSearch code is ${code}. It expires in 10 minutes. Do not share it.`;
}
