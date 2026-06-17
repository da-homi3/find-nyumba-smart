import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export type TenantTrialState = {
  trialUnlocksRemaining: number;
  trialEndsAt: string | null;
  trialActive: boolean;
};

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
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const trialEndIso = trialEnd.toISOString();
    await db
      .from("profiles")
      .update({
        trial_unlocks_remaining: 3,
        trial_started_at: new Date().toISOString(),
        trial_ends_at: trialEndIso,
      })
      .eq("id", userId);
    return { trialUnlocksRemaining: 3, trialEndsAt: trialEndIso, trialActive: true };
  }

  const trialActive = Boolean(
    profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date(),
  );
  return {
    trialUnlocksRemaining: profile.trial_unlocks_remaining ?? 0,
    trialEndsAt: profile.trial_ends_at,
    trialActive,
  };
}
