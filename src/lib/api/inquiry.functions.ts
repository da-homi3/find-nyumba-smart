import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getKV } from "@/lib/api/storage";
import { sendInquiryEmail } from "@/lib/api/email";
import { v4 as uuidv4 } from "uuid";

export const createInquiry = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    listingId: z.string(),
    tenantId: z.string(),
    message: z.string().min(1),
    contactEmail: z.string().email()
  }))
  .handler(async ({ context, data }) => {
    const kv = getKV(context);
    const inquiryId = uuidv4();
    const inquiry = {
      id: inquiryId,
      listingId: data.listingId,
      tenantId: data.tenantId,
      message: data.message,
      contactEmail: data.contactEmail,
      createdAt: new Date().toISOString()
    };
    // Store inquiry in KV under "inquiries" namespace (or as a prefix)
    await kv.put(`inquiry:${inquiryId}`, JSON.stringify(inquiry));
    // Send email notification to landlord (email retrieved from listing later)
    await sendInquiryEmail(inquiry);
    return { success: true, inquiryId };
  });
