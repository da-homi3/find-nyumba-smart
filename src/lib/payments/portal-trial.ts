import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ListingPortal } from "@/lib/portal-paths";
import { PORTAL_UPGRADE_PLAN } from "@/lib/revenue/plans";
import type { LandlordPlan } from "@/lib/revenue/types";

type Admin = SupabaseClient<Database>;

export type PortalListerRole = "landlord" | "manager" | "agency";

export function portalRoleToListingPortal(role: PortalListerRole): ListingPortal {
  return role;
}

export function defaultTrialPlanForRole(role: PortalListerRole): LandlordPlan {
  return PORTAL_UPGRADE_PLAN[portalRoleToListingPortal(role)];
}

/**
 * Unpaid portal trials are disabled. The bonus free month is applied only after the
 * first successful paid subscription payment (see subscriptionPeriodDaysAfterPayment).
 */
export async function autoStartPortalTrial(
  _supabaseAdmin: Admin,
  _userId: string,
  _role: PortalListerRole,
): Promise<{ started: boolean; trialEnd?: string; subscriptionId?: string; plan?: LandlordPlan }> {
  return { started: false };
}
