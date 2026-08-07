import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { asLooseDb } from "@/lib/db/loose-client";

type Admin = SupabaseClient<Database>;

const MONTHLY_REFERRAL_CAP = 10;

export async function flagSuspiciousReferral(
  admin: Admin,
  referral: { id: string; referrer_user_id: string; referred_user_id: string },
): Promise<boolean> {
  const db = asLooseDb(admin);
  const [{ data: referrer }, { data: referred }] = await Promise.all([
    admin
      .from("profiles")
      .select("phone, full_name")
      .eq("id", referral.referrer_user_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("phone, full_name")
      .eq("id", referral.referred_user_id)
      .maybeSingle(),
  ]);

  const suspicious = referrer?.phone && referred?.phone && referrer.phone === referred.phone;

  if (suspicious) {
    await db.from("referrals").update({ status: "fraud_flagged" }).eq("id", referral.id);

    console.warn("[referrals] fraud flagged:", referral.id);
    return true;
  }
  return false;
}

export async function referrerAtCap(admin: Admin, referrerId: string): Promise<boolean> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { count } = await asLooseDb(admin)
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", referrerId)
    .eq("status", "converted")
    .gte("converted_at", startOfMonth.toISOString());

  return (count ?? 0) >= MONTHLY_REFERRAL_CAP;
}
