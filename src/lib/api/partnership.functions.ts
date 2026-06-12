import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "@/lib/api/rate-limit";

const inquirySchema = z.object({
  inquiryType: z.enum(["advertise", "insurance", "service_quote", "service_register", "finance"]),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(9).max(20),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().trim().max(200).optional(),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  metadata: z.record(z.string()).optional(),
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
      `Name: ${data.name}`,
      `Phone: ${data.phone}`,
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
    checkRateLimit(`inquiry:${data.phone}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmailNotification, OPS_EMAIL } = await import("@/lib/api/notify");

    const payload = {
      inquiry_type: data.inquiryType,
      contact_name: data.name,
      phone: data.phone,
      email: data.email || null,
      company: data.company ?? null,
      subject: data.subject,
      message: data.message,
      metadata: data.metadata ?? {},
    };

    const { error: dbError } = await supabaseAdmin.from("partnership_inquiries").insert(payload);

    const sent = await sendEmailNotification({
      to: OPS_EMAIL,
      subject: `[NyumbaSearch] ${data.subject}`,
      text: formatInquiryEmail(data),
    });

    if (dbError && !sent) {
      throw new Error(
        "Could not submit your request right now. Please try again or email support.",
      );
    }

    return { ok: true, stored: !dbError, emailed: sent };
  });
