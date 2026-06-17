import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { applySubscriptionBenefits } from "@/lib/payments/apply-subscription-benefits";
import { addDaysFromNow } from "@/lib/payments/trial-eligibility";

type Admin = SupabaseClient<Database>;

export type StartTrialInput = {
  userId: string;
  paymentType: string;
  plan: string;
  billingCycle: "monthly" | "quarterly";
  paymentMethod: "mpesa" | "card";
  amountKes: number;
  providerId?: string;
};

export async function startTrialingSubscription(
  supabaseAdmin: Admin,
  input: StartTrialInput,
): Promise<{ subscriptionId: string; trialEnd: string }> {
  const trialEnd = addDaysFromNow(30);

  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: input.userId,
      plan: input.plan,
      status: "trialing",
      amount_kes: input.amountKes,
      billing_cycle: input.billingCycle,
      payment_method: input.paymentMethod,
      next_billing_date: trialEnd,
      trial_end: trialEnd,
    })
    .select("id")
    .single();

  if (error) throw error;

  await applySubscriptionBenefits(
    supabaseAdmin,
    input.userId,
    input.paymentType,
    input.plan,
    trialEnd,
    input.providerId,
  );

  if (input.paymentType === "provider_subscription" && input.providerId) {
    await supabaseAdmin
      .from("service_providers")
      .update({ subscription_id: sub.id })
      .eq("id", input.providerId);
  }

  return { subscriptionId: sub.id, trialEnd };
}
