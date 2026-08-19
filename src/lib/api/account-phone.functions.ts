import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { normalizeKenyanPhoneLocal } from "@/lib/phone";

export const saveAccountPhoneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ phone: z.string().min(9).max(20) }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const phone = normalizeKenyanPhoneLocal(data.phone);
    if (!phone) {
      throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").upsert(
      { id: userId, phone, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existing.user?.user_metadata,
        phone,
      },
    });
    if (metaError) throw new Error(metaError.message);

    return { phone };
  });
