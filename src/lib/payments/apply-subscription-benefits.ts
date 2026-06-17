import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveLandlordPlan } from "@/lib/revenue/plans";

type Admin = SupabaseClient<Database>;

export async function applySubscriptionBenefits(
  supabaseAdmin: Admin,
  userId: string,
  paymentType: string,
  plan: string,
  periodEndIso: string,
  providerId?: string,
) {
  if (paymentType === "tenant_plus") {
    await supabaseAdmin
      .from("profiles")
      .update({ tenant_plan: "plus", plus_expires_at: periodEndIso })
      .eq("id", userId);
    return;
  }

  if (paymentType === "landlord_plan" || paymentType === "premium_subscription") {
    const landlordPlan = resolveLandlordPlan(plan);
    await supabaseAdmin
      .from("profiles")
      .update({ landlord_plan: landlordPlan, is_portal_active: true })
      .eq("id", userId);
    return;
  }

  if (paymentType === "provider_subscription") {
    const tier = plan === "featured" || plan === "premium" ? plan : "basic";
    let query = supabaseAdmin
      .from("service_providers")
      .update({ status: "active", tier })
      .eq("user_id", userId);
    if (providerId) query = query.eq("id", providerId);
    await query;
  }
}
