import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";

export const getVerificationRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ requestId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);

    const { data: row, error } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();

    if (error) throw error;
    if (!row) throw new Error("Verification request not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    const userEmail = profile?.email?.toLowerCase();
    if (userEmail && row.requester_email.toLowerCase() !== userEmail) {
      throw new Error("You do not have access to this verification request");
    }

    return row;
  });
