import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  LEVEL_BENEFITS,
  LEVEL_THRESHOLDS,
  asLoyaltyLevel,
  type LoyaltyLevel,
  resolveLoyaltyLevel,
} from "@/lib/loyalty/benefits";

type Admin = SupabaseClient<Database>;

export type LoyaltyReason =
  | "on_time_rent_payment"
  | "profile_verified"
  | "lease_renewed"
  | "referral_converted"
  | "maintenance_job_completed"
  | "listing_kept_updated";

export const POINT_VALUES: Record<LoyaltyReason, number> = {
  on_time_rent_payment: 15,
  profile_verified: 30,
  lease_renewed: 40,
  referral_converted: 50,
  maintenance_job_completed: 20,
  listing_kept_updated: 5,
};

const POINT_EARNING_LIMITS: Partial<Record<LoyaltyReason, { max: number; windowDays: number }>> = {
  listing_kept_updated: { max: 4, windowDays: 30 },
  referral_converted: { max: 10, windowDays: 30 },
};

export async function canAwardPoints(
  admin: Admin,
  userId: string,
  reason: LoyaltyReason,
): Promise<boolean> {
  const limit = POINT_EARNING_LIMITS[reason];
  if (!limit) return true;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - limit.windowDays);

  const { count, error } = await admin
    .from("loyalty_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reason", reason)
    .gte("created_at", since.toISOString());

  if (error) {
    console.warn("[loyalty] canAwardPoints failed", error.message);
    return false;
  }
  return (count ?? 0) < limit.max;
}

export async function awardPoints(
  admin: Admin,
  opts: {
    userId: string;
    reason: LoyaltyReason;
    relatedId?: string | null;
  },
): Promise<{ awarded: boolean; level?: LoyaltyLevel; totalPoints?: number }> {
  const allowed = await canAwardPoints(admin, opts.userId, opts.reason);
  if (!allowed) return { awarded: false };

  const points = POINT_VALUES[opts.reason];
  const relatedId = opts.relatedId ?? null;

  const { error: txError } = await admin.from("loyalty_transactions").insert({
    user_id: opts.userId,
    points,
    reason: opts.reason,
    related_id: relatedId,
  });

  if (txError) {
    if (/duplicate|unique/i.test(txError.message ?? "")) return { awarded: false };
    console.warn("[loyalty] insert tx failed", txError.message);
    return { awarded: false };
  }

  const { data: existing } = await admin
    .from("loyalty_points")
    .select("total_points, current_level")
    .eq("user_id", opts.userId)
    .maybeSingle();

  const prevTotal = existing?.total_points ?? 0;
  const prevLevel = (existing?.current_level as LoyaltyLevel | undefined) ?? "bronze";
  const nextTotal = prevTotal + points;
  const nextLevel = resolveLoyaltyLevel(nextTotal);

  const { error: upsertError } = await admin.from("loyalty_points").upsert(
    {
      user_id: opts.userId,
      total_points: nextTotal,
      current_level: nextLevel,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    console.warn("[loyalty] upsert points failed", upsertError.message);
    return { awarded: true, totalPoints: nextTotal, level: prevLevel };
  }

  if (nextLevel !== prevLevel) {
    await notifyLevelUp(admin, opts.userId, nextLevel, nextTotal);
  }

  return { awarded: true, totalPoints: nextTotal, level: nextLevel };
}

async function notifyLevelUp(
  admin: Admin,
  userId: string,
  level: LoyaltyLevel,
  totalPoints: number,
): Promise<void> {
  try {
    const { notifyUser } = await import("@/lib/notifications/notify-user");
    const label = level.charAt(0).toUpperCase() + level.slice(1);
    await notifyUser(admin, {
      userId,
      type: "account",
      title: `You've reached ${label} status`,
      body: `You now have ${totalPoints} loyalty points. Enjoy your ${label} benefits.`,
      href: "/settings",
      entityType: "loyalty",
      entityId: level,
    });
  } catch (err) {
    console.warn("[loyalty] level-up notify failed", err);
  }
}

export async function getLoyaltyLevel(admin: Admin, userId: string): Promise<LoyaltyLevel> {
  const { data } = await admin
    .from("loyalty_points")
    .select("current_level")
    .eq("user_id", userId)
    .maybeSingle();
  return asLoyaltyLevel(data?.current_level ?? "bronze");
}

export async function getLoyaltySummary(admin: Admin, userId: string) {
  const { data } = await admin
    .from("loyalty_points")
    .select("total_points, current_level")
    .eq("user_id", userId)
    .maybeSingle();

  const totalPoints = data?.total_points ?? 0;
  const currentLevel = asLoyaltyLevel(data?.current_level ?? "bronze");
  const benefits = LEVEL_BENEFITS[currentLevel];

  const ordered = Object.entries(LEVEL_THRESHOLDS).sort((a, b) => a[1] - b[1]) as Array<
    [LoyaltyLevel, number]
  >;
  const idx = ordered.findIndex(([l]) => l === currentLevel);
  const next = ordered[idx + 1];
  const pointsToNext = next ? Math.max(0, next[1] - totalPoints) : 0;

  return {
    totalPoints,
    currentLevel,
    benefits,
    nextLevel: next?.[0] ?? null,
    pointsToNext,
  };
}

export { LEVEL_THRESHOLDS };
