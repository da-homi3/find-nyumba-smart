import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  campaignIdForRole,
  isPromoEligibleRole,
  type PromoEligibleRole,
} from "@/lib/promo/constants";

type Admin = SupabaseClient<Database>;

export type ClaimSlotResult = {
  claimed: boolean;
  slotNumber?: number;
  campaignId?: string;
};

async function ensureProfileRow(admin: Admin, userId: string, fullName?: string, phone?: string) {
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return;
  await admin.from("profiles").insert({
    id: userId,
    full_name: fullName ?? null,
    phone: phone ?? null,
  });
}

export async function tryClaimFoundingMemberSlot(
  admin: Admin,
  userId: string,
  role: PromoEligibleRole,
  profile?: { fullName?: string; phone?: string },
): Promise<ClaimSlotResult> {
  if (!isPromoEligibleRole(role)) return { claimed: false };

  await ensureProfileRow(admin, userId, profile?.fullName, profile?.phone);

  const campaignId = campaignIdForRole(role);
  const { data, error } = await admin.rpc("claim_founding_member_slot", {
    p_user_id: userId,
    p_campaign_id: campaignId,
  });

  if (error) {
    console.error("[promo] claim slot failed:", error.message);
    return { claimed: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const claimed = Boolean(row?.claimed);
  const slotNumber = row?.slot_number ?? undefined;

  if (!claimed) return { claimed: false };

  return { claimed: true, slotNumber, campaignId };
}

export async function releaseFoundingMemberSlot(admin: Admin, userId: string): Promise<void> {
  const { error } = await admin.rpc("release_founding_member_slot", { p_user_id: userId });
  if (error) console.error("[promo] release slot failed:", error.message);
}

export async function confirmFoundingMemberBonus(admin: Admin, userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("confirm_founding_member_bonus", { p_user_id: userId });
  if (error) {
    console.error("[promo] confirm bonus failed:", error.message);
    return false;
  }
  return Boolean(data);
}
