import type { SupabaseClient } from "@supabase/supabase-js";
import { asLooseDb } from "@/lib/db/loose-client";
import { plusCreditsForBillingCycle } from "@/lib/revenue/tenant-plus-config";

type AnyDb = SupabaseClient;

async function recordCreditLedger(
  db: AnyDb,
  input: {
    userId: string;
    delta: number;
    remaining: number;
    reason: string;
    listingId?: string;
  },
) {
  const { error } = await asLooseDb(db).from("contact_credit_ledger").insert({
    user_id: input.userId,
    delta: input.delta,
    remaining: input.remaining,
    reason: input.reason,
    listing_id: input.listingId ?? null,
  });
  if (error) console.warn("[plus-credits] ledger:", error.message);
}

export async function getPlusContactCredits(db: AnyDb, userId: string): Promise<number> {
  const loose = asLooseDb(db);
  const { data, error } = await loose
    .from("profiles")
    .select("plus_contact_credits")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[plus-credits] read failed:", error.message);
    return 0;
  }
  const raw = (data as { plus_contact_credits?: number } | null)?.plus_contact_credits;
  return Math.max(0, Number(raw) || 0);
}

export async function grantPlusContactCredits(
  db: AnyDb,
  userId: string,
  cycle: "monthly" | "quarterly",
): Promise<number> {
  const add = plusCreditsForBillingCycle(cycle);
  const current = await getPlusContactCredits(db, userId);
  const next = current + add;
  const loose = asLooseDb(db);
  const { error } = await loose
    .from("profiles")
    .update({ plus_contact_credits: next })
    .eq("id", userId);
  if (error) {
    console.warn("[plus-credits] grant failed:", error.message);
    return current;
  }
  await recordCreditLedger(db, {
    userId,
    delta: add,
    remaining: next,
    reason: `grant_${cycle}`,
  });
  return next;
}

export async function consumePlusContactCredits(
  db: AnyDb,
  userId: string,
  credits: number,
): Promise<{ ok: boolean; remaining: number }> {
  const cost = Math.max(1, Math.trunc(credits));
  const loose = asLooseDb(db);
  const current = await getPlusContactCredits(db, userId);
  if (current < cost) return { ok: false, remaining: current };

  const { data, error } = await loose
    .from("profiles")
    .update({ plus_contact_credits: current - cost })
    .eq("id", userId)
    .gte("plus_contact_credits", cost)
    .select("plus_contact_credits")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, remaining: current };
  }
  const remaining = Math.max(0, Number((data as { plus_contact_credits?: number }).plus_contact_credits) || 0);
  await recordCreditLedger(db, {
    userId,
    delta: -cost,
    remaining,
    reason: "consume_unlock",
  });
  return { ok: true, remaining };
}

export async function adjustPlusContactCredits(
  db: AnyDb,
  userId: string,
  delta: number,
  reason: string,
): Promise<number> {
  const current = await getPlusContactCredits(db, userId);
  const next = Math.max(0, current + delta);
  const loose = asLooseDb(db);
  const { error } = await loose.from("profiles").update({ plus_contact_credits: next }).eq("id", userId);
  if (error) {
    console.warn("[plus-credits] adjust failed:", error.message);
    return current;
  }
  await recordCreditLedger(db, { userId, delta, remaining: next, reason });
  return next;
}
