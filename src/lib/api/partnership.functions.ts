import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getSiteUrl } from "@/lib/site";
import { formatKes } from "@/lib/properties";
import { ADVERTISE_PACKAGES } from "@/lib/revenue/plans";

const inquirySchema = z
  .object({
    inquiryType: z.enum([
      "advertise",
      "insurance",
      "service_quote",
      "service_register",
      "finance",
      "app_notify",
    ]),
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().min(9).max(20).optional(),
    email: z.string().email().optional().or(z.literal("")),
    company: z.string().trim().max(200).optional(),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(3).max(5000),
    metadata: z.record(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.inquiryType === "app_notify") {
      if (!data.email?.includes("@")) {
        ctx.addIssue({ code: "custom", message: "Email required", path: ["email"] });
      }
      return;
    }
    if (data.inquiryType === "advertise") {
      if (!data.name || data.name.length < 2) {
        ctx.addIssue({ code: "custom", message: "Name required", path: ["name"] });
      }
      const contact = data.email?.includes("@")
        ? data.email
        : (data.phone ?? data.metadata?.contact ?? "");
      if (!contact || (contact.length < 9 && !contact.includes("@"))) {
        ctx.addIssue({
          code: "custom",
          message: "Valid email or phone required",
          path: ["email"],
        });
      }
      return;
    }
    if (!data.name || data.name.length < 2) {
      ctx.addIssue({ code: "custom", message: "Name required", path: ["name"] });
    }
    if (!data.phone || data.phone.length < 9) {
      ctx.addIssue({ code: "custom", message: "Phone required", path: ["phone"] });
    }
  });

type InquiryPayload = z.infer<typeof inquirySchema>;

function parseEmailFromContact(contact: string | undefined, email?: string): string | null {
  if (email?.includes("@")) return email.trim();
  if (!contact) return null;
  const match = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(contact);
  return match?.[0]?.toLowerCase() ?? null;
}

function formatInquiryEmail(data: InquiryPayload): string {
  const metaLines = data.metadata
    ? Object.entries(data.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    : "";
  const metaBlock = metaLines ? `\n---\n${metaLines}` : "";
  return (
    [
      `Type: ${data.inquiryType}`,
      `Name: ${data.name || "—"}`,
      `Phone: ${data.phone || "—"}`,
      `Email: ${data.email || "—"}`,
      `Company: ${data.company || "—"}`,
      "",
      data.message,
    ].join("\n") + metaBlock
  );
}

function opsRecipientFor(data: InquiryPayload): string {
  if (data.inquiryType === "advertise" || data.inquiryType === "app_notify") {
    return process.env.ADVERTISE_OPS_EMAIL ?? "nyumbasearch101@gmail.com";
  }
  return process.env.OPS_NOTIFICATION_EMAIL ?? "nyumbasearch101@gmail.com";
}

async function sendSubmitterConfirmation(data: InquiryPayload, inquiryId?: string) {
  const submitterEmail =
    parseEmailFromContact(data.metadata?.contact, data.email ?? undefined) ??
    (data.email?.includes("@") ? data.email : null);
  if (!submitterEmail) return false;

  const { sendEmail } = await import("@/lib/email/send");
  const site = getSiteUrl();

  if (data.inquiryType === "advertise") {
    const packageId = data.metadata?.package ?? "banner";
    const pkg = ADVERTISE_PACKAGES.find((p) => p.id === packageId) ?? ADVERTISE_PACKAGES[0];
    const refQuery = inquiryId ? `&ref=${inquiryId}` : "";
    const payUrl = `${site}/advertise/pay?package=${packageId}${refQuery}`;
    const text = [
      `Hi ${data.name ?? "there"},`,
      "",
      "Thank you for your interest in advertising on NyumbaSearch. Your inquiry has been approved.",
      "",
      `Package: ${pkg.name} — ${formatKes(pkg.priceKes)}/month`,
      `Placement: ${pkg.placement}`,
      "",
      "Complete payment to activate your campaign:",
      payUrl,
      "",
      "Questions? Reply to this email or contact nyumbasearch101@gmail.com",
    ].join("\n");
    return sendEmail({
      to: submitterEmail,
      subject: "NyumbaSearch advertising — complete your payment",
      text,
      html: text.replaceAll("\n", "<br>"),
      templateId: "advertise-approved",
    });
  }

  if (data.inquiryType === "app_notify") {
    const text = [
      "You're on the list!",
      "",
      "We'll email you as soon as the NyumbaSearch mobile app launches.",
      "Save searches, get instant alerts, and message landlords on the go.",
      "",
      site,
    ].join("\n");
    return sendEmail({
      to: submitterEmail,
      subject: "NyumbaSearch mobile app — you're on the list",
      text,
      html: text.replaceAll("\n", "<br>"),
      templateId: "app-notify-confirm",
    });
  }

  if (data.inquiryType === "insurance" || data.inquiryType === "finance") {
    const text = [
      `Hi ${data.name ?? "there"},`,
      "",
      `We received your ${data.inquiryType} inquiry and our team will contact you within 1 business day.`,
      "",
      `Reference: ${data.subject}`,
      "",
      "NyumbaSearch — nyumbasearch.com",
    ].join("\n");
    return sendEmail({
      to: submitterEmail,
      subject: `NyumbaSearch — ${data.inquiryType} inquiry received`,
      text,
      html: text.replaceAll("\n", "<br>"),
      templateId: "inquiry-confirm",
    });
  }

  return false;
}

export const submitPartnershipInquiry = createServerFn({ method: "POST" })
  .inputValidator(inquirySchema)
  .handler(async ({ data }) => {
    const rateKey =
      data.inquiryType === "app_notify"
        ? `inquiry:${data.email}`
        : `inquiry:${data.phone ?? data.email}`;
    checkRateLimit(rateKey);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail } = await import("@/lib/email/send");

    const contactName = data.name ?? (data.inquiryType === "app_notify" ? "App waitlist" : "");
    const phone = data.phone ?? (data.inquiryType === "app_notify" ? "—" : "");
    const parsedEmail =
      parseEmailFromContact(data.metadata?.contact, data.email ?? undefined) ??
      (data.email?.includes("@") ? data.email : null);

    const payload = {
      inquiry_type: data.inquiryType,
      contact_name: contactName,
      phone,
      email: parsedEmail,
      company: data.company ?? null,
      subject: data.subject,
      message: data.message,
      metadata: data.metadata ?? {},
    };

    const { data: inserted, error: dbError } = await supabaseAdmin
      .from("partnership_inquiries")
      .insert(payload)
      .select("id")
      .single();

    const opsTo = opsRecipientFor(data);
    const sent = await sendEmail({
      to: opsTo,
      subject: `[NyumbaSearch] ${data.subject}`,
      text: formatInquiryEmail(data),
      html: formatInquiryEmail(data).replaceAll("\n", "<br>"),
      templateId: "partnership-inquiry",
    });

    if (dbError && !sent) {
      throw new Error(
        "Could not submit your request right now. Please try again or email support.",
      );
    }

    void sendSubmitterConfirmation(data, inserted?.id);

    return { ok: true, stored: !dbError, emailed: sent, inquiryId: inserted?.id ?? null };
  });
