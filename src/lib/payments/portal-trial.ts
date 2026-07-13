import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ListingPortal } from "@/lib/portal-paths";
import { PORTAL_UPGRADE_PLAN, planMonthlyPrice } from "@/lib/revenue/plans";
import type { LandlordPlan } from "@/lib/revenue/types";
import { startTrialingSubscription } from "@/lib/payments/start-trial-subscription";
import { isFirstTimeSubscriber } from "@/lib/payments/trial-eligibility";

type Admin = SupabaseClient<Database>;

export type PortalListerRole = "landlord" | "manager" | "agency";

export function portalRoleToListingPortal(role: PortalListerRole): ListingPortal {
  return role;
}

export function defaultTrialPlanForRole(role: PortalListerRole): LandlordPlan {
  return PORTAL_UPGRADE_PLAN[portalRoleToListingPortal(role)];
}

export async function autoStartPortalTrial(
  supabaseAdmin: Admin,
  userId: string,
  role: PortalListerRole,
): Promise<{ started: boolean; trialEnd?: string; subscriptionId?: string; plan?: LandlordPlan }> {
  if (!(await isFirstTimeSubscriber(supabaseAdmin, userId))) {
    return { started: false };
  }

  const plan = defaultTrialPlanForRole(role);
  const amountKes = planMonthlyPrice(plan, "monthly");

  const { trialEnd, subscriptionId } = await startTrialingSubscription(supabaseAdmin, {
    userId,
    paymentType: "landlord_plan",
    plan,
    billingCycle: "monthly",
    paymentMethod: "mpesa",
    amountKes,
  });

  return { started: true, trialEnd, subscriptionId, plan };
}
