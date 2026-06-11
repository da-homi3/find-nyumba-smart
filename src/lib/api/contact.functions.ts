import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendEmailNotification, OPS_EMAIL } from "@/lib/api/notify";

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      message: z.string().trim().min(10).max(5000),
    }),
  )
  .handler(async ({ data }) => {
    const sent = await sendEmailNotification({
      to: OPS_EMAIL,
      subject: `[NyumbaSearch] Contact form — ${data.email}`,
      text: `From: ${data.email}\n\n${data.message}`,
    });
    if (!sent) {
      throw new Error("Could not send your message right now. Please email us directly.");
    }
    return { ok: true };
  });
