import sgMail from "@sendgrid/mail";
import type { Json } from "@/integrations/supabase/types";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  templateId?: string;
  metadata?: Record<string, unknown>;
};

export type SendEmailResult = { ok: true; providerId?: string } | { ok: false; reason: string };

type EnvHolder = { __env__?: Record<string, unknown> };

type CloudflareEmailBinding = {
  send: (msg: {
    to: string | string[];
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }) => Promise<{ messageId?: string }>;
};

function fromParts(): { email: string; name: string } {
  const email =
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    "hello@nyumbasearch.com";
  const name = process.env.EMAIL_FROM_NAME?.trim() || "NyumbaSearch";
  return { email, name };
}

function fromAddress(): string {
  const { email, name } = fromParts();
  return `${name} <${email}>`;
}

function getCloudflareEmail(): CloudflareEmailBinding | undefined {
  const env = (globalThis as EnvHolder).__env__;
  const binding = env?.EMAIL;
  if (!binding || typeof binding !== "object") return undefined;
  if (typeof (binding as CloudflareEmailBinding).send !== "function") return undefined;
  return binding as CloudflareEmailBinding;
}

async function logEmailAttempt(
  payload: EmailPayload,
  status: "sent" | "failed",
  providerId?: string,
  failureReason?: string,
  provider?: string,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_log").insert({
      to_email: payload.to,
      template_id: payload.templateId ?? "unknown",
      subject: payload.subject,
      status,
      provider_id: providerId ?? null,
      metadata: {
        ...((payload.metadata ?? undefined) as Record<string, unknown> | undefined),
        ...(failureReason ? { failureReason } : undefined),
        ...(provider ? { provider } : undefined),
      } as Json,
    });
  } catch (err) {
    console.warn("[email] Could not write email_log:", err);
  }
}

function sendgridFailureReason(err: unknown): string {
  const response =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { body?: unknown; statusCode?: number } }).response
      : undefined;
  const body = response?.body;
  let providerMessage = "";
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Array<{ message?: string }> }).errors;
    providerMessage =
      errors
        ?.map((e) => e.message)
        .filter(Boolean)
        .join("; ") ?? "";
  } else if (err instanceof Error) {
    providerMessage = err.message;
  }

  const lower = providerMessage.toLowerCase();
  if (lower.includes("maximum credits exceeded") || lower.includes("credits exceeded")) {
    return "SendGrid credits exhausted — top up the SendGrid account (or replace the API key), then retry.";
  }
  if (response?.statusCode === 401 || lower.includes("unauthorized")) {
    return "SendGrid rejected the API key — check SENDGRID_API_KEY in Worker secrets.";
  }
  if (!process.env.SENDGRID_API_KEY) {
    return "SENDGRID_API_KEY is not configured.";
  }
  return providerMessage || "SendGrid request failed.";
}

async function sendViaCloudflare(payload: EmailPayload): Promise<SendEmailResult | null> {
  const email = getCloudflareEmail();
  if (!email) return null;

  try {
    const from = fromParts();
    const res = await email.send({
      to: payload.to,
      from: { email: from.email, name: from.name },
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    const providerId = res?.messageId ? `cf:${res.messageId}` : "cf:ok";
    await logEmailAttempt(payload, "sent", providerId, undefined, "cloudflare");
    return { ok: true, providerId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Cloudflare Email send failed.";
    console.error("[email] Cloudflare Email failed:", payload.templateId, reason, err);
    await logEmailAttempt(payload, "failed", undefined, reason, "cloudflare");
    // Fall through to SendGrid
    return { ok: false, reason };
  }
}

async function sendViaSendGrid(payload: EmailPayload): Promise<SendEmailResult> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    return { ok: false, reason: "SENDGRID_API_KEY is not configured." };
  }

  try {
    sgMail.setApiKey(key);
    // Keep CTA URLs as-is (e.g. /tenant/invite/…). Account-level SendGrid click
    // tracking was rewriting them to url7389.nyumbasearch.com (broken SSL).
    const [res] = await sgMail.send({
      to: payload.to,
      from: fromAddress(),
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
        subscriptionTracking: { enable: false },
      },
    });
    const providerId = res?.headers?.["x-message-id"] as string | undefined;
    await logEmailAttempt(payload, "sent", providerId, undefined, "sendgrid");
    return { ok: true, providerId };
  } catch (err) {
    const reason = sendgridFailureReason(err);
    console.error("[email] SendGrid failed:", payload.templateId, reason, err);
    await logEmailAttempt(payload, "failed", undefined, reason, "sendgrid");
    return { ok: false, reason };
  }
}

/**
 * Sends transactional email.
 * Prefer Cloudflare Email Sending when the EMAIL binding is present;
 * fall back to SendGrid when Cloudflare is unavailable or fails.
 */
export async function sendEmailResult(payload: EmailPayload): Promise<SendEmailResult> {
  if (!payload.to) {
    const reason = "Missing recipient email.";
    console.warn("[email] Skipped send —", reason, payload.templateId);
    await logEmailAttempt(payload, "failed", undefined, reason);
    return { ok: false, reason };
  }

  const cf = await sendViaCloudflare(payload);
  if (cf?.ok) return cf;

  const sg = await sendViaSendGrid(payload);
  if (sg.ok) return sg;

  // Prefer Cloudflare's error when both fail and CF was attempted.
  return {
    ok: false,
    reason: cf?.reason ?? sg.reason ?? "Email could not be sent.",
  };
}

/** @deprecated Prefer sendEmailResult when callers need failure reasons. */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const result = await sendEmailResult(payload);
  return result.ok;
}
