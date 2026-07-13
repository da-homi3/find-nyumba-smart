import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  canViewLeadContactDetails,
  type LeadContactAccessInput,
  type PortalSubscriptionStatus,
} from "@/lib/revenue/entitlements";
import { getActiveLandlordPlan, getPortalSubscriptionMeta } from "@/lib/revenue/subscription-store";

type Db = SupabaseClient<Database>;

export async function resolveLeadContactAccess(
  supabase: Db,
  userId: string,
): Promise<LeadContactAccessInput & { canView: boolean }> {
  const [landlordPlan, subscription, profile] = await Promise.all([
    getActiveLandlordPlan(supabase, userId),
    getPortalSubscriptionMeta(supabase, userId),
    supabase.from("profiles").select("lead_pack_balance").eq("id", userId).maybeSingle(),
  ]);

  const subscriptionStatus: PortalSubscriptionStatus = subscription?.status ?? "none";
  const leadPackBalance = profile.data?.lead_pack_balance ?? 0;
  const input: LeadContactAccessInput = {
    landlordPlan,
    subscriptionStatus,
    leadPackBalance,
  };

  return {
    ...input,
    canView: canViewLeadContactDetails(input),
  };
}

export function redactProfilePhone<T extends { phone?: string | null }>(
  profile: T | null | undefined,
  canView: boolean,
): T | null | undefined {
  if (canView || !profile) return profile;
  return { ...profile, phone: null };
}
