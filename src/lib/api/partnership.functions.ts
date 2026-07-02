import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "@/lib/api/rate-limit";

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
    if (!data.name || data.name.length < 2) {
      ctx.addIssue({ code: "custom", message: "Name required", path: ["name"] });
    }
    if (!data.phone || data.phone.length < 9) {
      ctx.addIssue({ code: "custom", message: "Phone required", path: ["phone"] });
    }
  });

type InquiryPayload = z.infer<typeof inquirySchema>;

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
    const { OPS_EMAIL } = await import("@/lib/api/notify");

    const contactName = data.name ?? (data.inquiryType === "app_notify" ? "App waitlist" : "");
    const phone = data.phone ?? (data.inquiryType === "app_notify" ? "—" : "");

    const payload = {
      inquiry_type: data.inquiryType,
      contact_name: contactName,
      phone,
      email: data.email || null,
      company: data.company ?? null,
      subject: data.subject,
      message: data.message,
      metadata: data.metadata ?? {},
    };

    const { error: dbError } = await supabaseAdmin.from("partnership_inquiries").insert(payload);

    const sent = await sendEmail({
      to: OPS_EMAIL,
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

    return { ok: true, stored: !dbError, emailed: sent };
  });
