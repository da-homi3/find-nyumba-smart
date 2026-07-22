import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export const TENANT_FREE_UNLOCK_ALLOWANCE = 3;

export type TenantTrialState = {
  trialUnlocksRemaining: number;
  trialEndsAt: string | null;
  trialActive: boolean;
};

/**
 * Tenants get 3 free contact unlocks. Access stays free until those are used;
 * after that they need Plus for unlimited unlocks / subscription features.
 */
export async function ensureTenantTrial(db: Db, userId: string): Promise<TenantTrialState> {
  const { data: profile } = await db
    .from("profiles")
    .select("trial_unlocks_remaining, trial_started_at, trial_ends_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return { trialUnlocksRemaining: 0, trialEndsAt: null, trialActive: false };
  }

  if (!profile.trial_started_at) {
    await db
      .from("profiles")
      .update({
        trial_unlocks_remaining: TENANT_FREE_UNLOCK_ALLOWANCE,
        trial_started_at: new Date().toISOString(),
        // No short expiry — free unlocks remain until spent.
        trial_ends_at: null,
      })
      .eq("id", userId);
    return {
      trialUnlocksRemaining: TENANT_FREE_UNLOCK_ALLOWANCE,
      trialEndsAt: null,
      trialActive: true,
    };
  }

  const remaining = Math.max(0, profile.trial_unlocks_remaining ?? 0);
  return {
    trialUnlocksRemaining: remaining,
    trialEndsAt: profile.trial_ends_at,
    trialActive: remaining > 0,
  };
}
