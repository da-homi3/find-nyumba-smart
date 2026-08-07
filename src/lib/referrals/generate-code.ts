import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { asLooseDb } from "@/lib/db/loose-client";

type Admin = SupabaseClient<Database>;

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "NS-";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Ensures the user has a referral code. Generates one if missing.
 * Returns the code.
 */
export async function ensureReferralCode(admin: Admin, userId: string): Promise<string> {
  const db = asLooseDb(admin);
  const { data: profile } = await db
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();

  const existing = profile?.referral_code;
  if (existing) return existing as string;

  // Generate unique code with retry
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await db
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId)
      .is("referral_code", null);

    if (!error) return code;
    if (error && /duplicate|unique/i.test(error.message ?? "")) continue;
    throw error;
  }

  throw new Error("Failed to generate unique referral code");
}
