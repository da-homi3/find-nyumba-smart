import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type ReputationFactorType =
  | "identity_verified"
  | "ownership_verified"
  | "on_time_payment"
  | "late_payment"
  | "quick_response"
  | "tenant_satisfaction_rating"
  | "job_completed"
  | "job_incomplete";

export const FACTOR_WEIGHTS: Record<ReputationFactorType, number> = {
  identity_verified: 8,
  ownership_verified: 10,
  on_time_payment: 1.5,
  late_payment: -3,
  quick_response: 0.5,
  tenant_satisfaction_rating: 2,
  job_completed: 2,
  job_incomplete: -4,
};

/** Insert a factor once per related_id (idempotent), then recalculate aggregate score. */
export async function recordFactor(
  admin: Admin,
  opts: {
    userId: string;
    factorType: ReputationFactorType;
    relatedId?: string | null;
  },
): Promise<void> {
  const weight = FACTOR_WEIGHTS[opts.factorType];
  const relatedId = opts.relatedId ?? null;

  const { error } = await admin.from("reputation_factors").insert({
    user_id: opts.userId,
    factor_type: opts.factorType,
    weight,
    related_id: relatedId,
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message ?? "")) return;
    console.warn("[reputation] recordFactor failed", error.message);
    return;
  }

  await recalculateReputation(admin, opts.userId);
}

export async function recalculateReputation(admin: Admin, userId: string): Promise<number> {
  const { data: factors, error } = await admin
    .from("reputation_factors")
    .select("factor_type")
    .eq("user_id", userId);

  if (error) {
    console.warn("[reputation] recalculate read failed", error.message);
    return 50;
  }

  const counts = new Map<string, number>();
  for (const row of factors ?? []) {
    counts.set(row.factor_type, (counts.get(row.factor_type) ?? 0) + 1);
  }

  let score = 50;
  for (const [type, count] of counts) {
    const w = FACTOR_WEIGHTS[type as ReputationFactorType];
    if (typeof w === "number") score += w * count;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const { error: upsertError } = await admin.from("reputation_scores").upsert(
    {
      user_id: userId,
      score,
      factors_computed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upsertError) {
    console.warn("[reputation] upsert score failed", upsertError.message);
  }
  return score;
}

export async function getReputationScore(admin: Admin, userId: string): Promise<number> {
  const { data } = await admin
    .from("reputation_scores")
    .select("score")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.score ?? 50;
}
