import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { confirmFoundingMemberBonus, releaseFoundingMemberSlot } from "@/lib/promo/claim-slot";
import { PROMO_LABELS, type PromoEligibleRole } from "@/lib/promo/constants";
import { sendEmail } from "@/lib/email/send";
import { foundingMemberClaimedEmail, foundingMemberConfirmedEmail } from "@/lib/email/templates";

type Admin = SupabaseClient<Database>;

export async function sendFoundingMemberClaimedEmail(opts: {
  email: string;
  name: string;
  role: PromoEligibleRole;
  slotNumber: number;
}) {
  const campaign = PROMO_LABELS[opts.role];
  const tpl = foundingMemberClaimedEmail({
    name: opts.name,
    slotNumber: opts.slotNumber,
    maxSlots: campaign.maxSlots,
    bonusListings: campaign.bonusListings,
    label: campaign.label,
  });
  await sendEmail({
    to: opts.email,
    templateId: "founding-member-claimed",
    ...tpl,
  });
}

/** First successful renewal after trial — activate bonus listing slots. */
export async function onFirstSuccessfulRenewal(admin: Admin, userId: string): Promise<void> {
  const { data: profile } = await admin
    .from("profiles")
    .select("founding_member_status, full_name, bonus_listing_slots")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.founding_member_status !== "pending") return;

  const confirmed = await confirmFoundingMemberBonus(admin, userId);
  if (!confirmed) return;

  const { cacheDelete } = await import("@/lib/cache/manager");
  void cacheDelete("promo_status");

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser.user?.email;
  if (!email) return;

  const { data: updated } = await admin
    .from("profiles")
    .select("founding_member_campaign_id, bonus_listing_slots")
    .eq("id", userId)
    .maybeSingle();

  const { data: campaign } = await admin
    .from("promo_campaigns")
    .select("bonus_listings")
    .eq("id", updated?.founding_member_campaign_id ?? "")
    .maybeSingle();

  const bonus = campaign?.bonus_listings ?? 0;
  const name =
    profile.full_name ??
    (authUser.user?.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0] ??
    "there";

  const tpl = foundingMemberConfirmedEmail({ name, bonusListings: bonus });
  await sendEmail({
    to: email,
    templateId: "founding-member-confirmed",
    ...tpl,
  });
}

/** Trial expired / payment failed — release slot back to pool. */
export async function onTrialFailedToConvert(admin: Admin, userId: string): Promise<void> {
  const { data: profile } = await admin
    .from("profiles")
    .select("founding_member_status")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.founding_member_status !== "pending") return;
  await releaseFoundingMemberSlot(admin, userId);
  const { cacheDelete } = await import("@/lib/cache/manager");
  void cacheDelete("promo_status");
}
