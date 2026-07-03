import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendEmail } from "@/lib/email/send";
import { baseLayout } from "@/lib/email/base-layout";
import { getSiteUrl } from "@/lib/site";
import { formatKes } from "@/lib/properties";
import { PLUS_PLAN } from "@/lib/revenue/plans";

type Admin = SupabaseClient<Database>;

async function alreadySent(admin: Admin, userId: string, templateId: string): Promise<boolean> {
  const { data } = await admin
    .from("marketing_email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .maybeSingle();
  return Boolean(data);
}

async function markSent(admin: Admin, userId: string, templateId: string) {
  await admin
    .from("marketing_email_log")
    .upsert({ user_id: userId, template_id: templateId }, { onConflict: "user_id,template_id" });
}

async function userEmail(admin: Admin, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email;
  if (!email) return null;
  const name = (data.user?.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
  return { email, name, userId };
}

function marketingOptIn(profile: { email_marketing_opt_in?: boolean | null } | null): boolean {
  return profile?.email_marketing_opt_in !== false;
}

function weekKey(): string {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function biweekKey(): string {
  const d = new Date();
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const biweek = Math.ceil(dayOfYear / 14);
  return `${d.getFullYear()}-B${biweek}`;
}

/** Tenants who spent ≥ KES 400 on unlocks in 30 days but are not Plus — nudge upgrade. */
export async function runUpgradeNudgeCron(admin: Admin) {
  const stats = { sent: 0 };
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const tplId = `sales_upgrade_nudge-${weekKey()}`;

  const { data: payments } = await admin
    .from("payments")
    .select("user_id, amount_kes")
    .eq("payment_type", "contact_unlock")
    .eq("status", "completed")
    .gte("created_at", since.toISOString());

  const spendByUser = new Map<string, number>();
  for (const p of payments ?? []) {
    if (!p.user_id) continue;
    spendByUser.set(p.user_id, (spendByUser.get(p.user_id) ?? 0) + (p.amount_kes ?? 0));
  }

  for (const [userId, total] of spendByUser) {
    if (total < 400) continue;
    if (await alreadySent(admin, userId, tplId)) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_plan, email_marketing_opt_in")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || profile.tenant_plan === "plus" || !marketingOptIn(profile)) continue;

    const ctx = await userEmail(admin, userId);
    if (!ctx) continue;

    const saving = Math.max(0, total - PLUS_PLAN.monthlyKes);
    const body = `
      <h1>KES ${formatKes(total)} spent on unlocks this month</h1>
      <p>Hi ${ctx.name}, NyumbaSearch Plus is <strong>${formatKes(PLUS_PLAN.monthlyKes)}/month</strong> with unlimited unlocks.</p>
      <p>At your pace, Plus saves you about <strong>KES ${formatKes(saving)}</strong> every month.</p>
      <p><a class="btn" href="${getSiteUrl()}/tenant/checkout?plan=plus&ref=upgrade_nudge">Switch to Plus</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: tplId,
      subject: `You've spent ${formatKes(total)} on unlocks — Plus saves you money`,
      text: `Plus is ${formatKes(PLUS_PLAN.monthlyKes)}/mo`,
      html: baseLayout({ preheader: "Upgrade to Plus", body }),
    });
    await markSent(admin, userId, tplId);
    stats.sent += 1;
    if (stats.sent >= 50) break;
  }

  return stats;
}

function aggregateSearchEvents(
  events: Array<{ user_id: string | null; neighborhood: string | null }> | null,
): Map<string, { count: number; hoods: Set<string> }> {
  const searchCount = new Map<string, { count: number; hoods: Set<string> }>();
  for (const e of events ?? []) {
    if (!e.user_id) continue;
    const entry = searchCount.get(e.user_id) ?? { count: 0, hoods: new Set<string>() };
    entry.count += 1;
    if (e.neighborhood) entry.hoods.add(e.neighborhood);
    searchCount.set(e.user_id, entry);
  }
  return searchCount;
}

async function eligibleForSearchNudge(
  admin: Admin,
  userId: string,
  tplId: string,
): Promise<{
  profile: { tenant_plan: string | null };
  ctx: { email: string; name: string };
} | null> {
  if (await alreadySent(admin, userId, tplId)) return null;

  const { data: unlock } = await admin
    .from("contact_unlocks")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (unlock) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_plan, email_marketing_opt_in")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || !marketingOptIn(profile)) return null;

  const { data: isTenant } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "tenant")
    .maybeSingle();
  if (!isTenant) return null;

  const ctx = await userEmail(admin, userId);
  if (!ctx) return null;

  return { profile, ctx };
}

/** Tenants with 3+ searches in 14 days but no contact unlocks. */
export async function runSearchNoUnlockCron(admin: Admin) {
  const stats = { sent: 0 };
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const tplId = `sales_search_no_unlock-${biweekKey()}`;

  const { data: events } = await admin
    .from("search_events")
    .select("user_id, neighborhood")
    .not("user_id", "is", null)
    .gte("created_at", since.toISOString());

  const searchCount = aggregateSearchEvents(events);

  for (const [userId, { count, hoods }] of searchCount) {
    if (count < 3) continue;

    const eligible = await eligibleForSearchNudge(admin, userId, tplId);
    if (!eligible) continue;

    const { ctx } = eligible;
    const areas = [...hoods].slice(0, 3).join(", ") || "Nairobi";
    const firstHood = [...hoods][0] ?? "Nairobi";
    const body = `
      <h1>You're close to finding your home</h1>
      <p>Hi ${ctx.name}, you've searched <strong>${count} times</strong> in ${areas} without unlocking a landlord contact yet.</p>
      <p>Unlocking costs <strong>KES 50–150</strong> once per property — or get unlimited unlocks with Plus at ${formatKes(PLUS_PLAN.monthlyKes)}/mo.</p>
      <p><a class="btn" href="${getSiteUrl()}/tenant?neighborhood=${encodeURIComponent(firstHood)}&ref=search_nudge">Continue searching</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: tplId,
      subject: `${ctx.name}, you've been searching — ready to take the next step?`,
      text: `Continue searching in ${areas}`,
      html: baseLayout({ preheader: `Searches in ${areas}`, body }),
    });
    await markSent(admin, userId, tplId);
    stats.sent += 1;
    if (stats.sent >= 100) break;
  }

  return stats;
}

/** Landlords with high views on free plan — upsell Pro. */
export async function runLandlordUpsellCron(admin: Admin) {
  const stats = { sent: 0 };
  const tplId = `sales_landlord_upsell_pro-${weekKey()}`;

  const { data: landlords } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "landlord")
    .limit(200);

  for (const row of landlords ?? []) {
    if (await alreadySent(admin, row.user_id, tplId)) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("landlord_plan, email_marketing_opt_in")
      .eq("id", row.user_id)
      .maybeSingle();
    if (profile?.landlord_plan !== "free" || !marketingOptIn(profile)) continue;

    const { data: properties } = await admin
      .from("properties")
      .select("views")
      .eq("owner_id", row.user_id)
      .eq("is_active", true);

    const totalViews = (properties ?? []).reduce((s, p) => s + (p.views ?? 0), 0);
    if (totalViews < 50) continue;

    const ctx = await userEmail(admin, row.user_id);
    if (!ctx) continue;

    const body = `
      <h1>Your listing has ${totalViews} views</h1>
      <p>Hi ${ctx.name}, your free listing is getting traction with ${totalViews} views.</p>
      <p>Try NyumbaSearch Pro for analytics, more listings, and priority verification.</p>
      <p><a class="btn" href="${getSiteUrl()}/landlord/checkout?plan=pro&ref=landlord_upsell">Try Pro — first month free</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: tplId,
      subject: `Your listing has ${totalViews} views — ready for Pro?`,
      text: "Upgrade to Pro",
      html: baseLayout({ preheader: "Landlord Pro upsell", body }),
    });
    await markSent(admin, row.user_id, tplId);
    stats.sent += 1;
    if (stats.sent >= 30) break;
  }

  return stats;
}

/** Landlords with low views after 7+ days — suggest listing boost. */
export async function runBoostSuggestionCron(admin: Admin) {
  const stats = { sent: 0 };
  const tplId = `sales_boost_suggestion-${biweekKey()}`;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: properties } = await admin
    .from("properties")
    .select("id, title, neighborhood, views, owner_id, created_at, featured_until, boost_package")
    .eq("is_active", true)
    .lt("views", 20)
    .lte("created_at", weekAgo.toISOString())
    .is("boost_package", null)
    .limit(100);

  const seenOwners = new Set<string>();
  for (const prop of properties ?? []) {
    if (!prop.owner_id || seenOwners.has(prop.owner_id)) continue;
    if (prop.featured_until && new Date(prop.featured_until).getTime() > Date.now()) continue;
    if (await alreadySent(admin, prop.owner_id, tplId)) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("email_marketing_opt_in")
      .eq("id", prop.owner_id)
      .maybeSingle();
    if (!marketingOptIn(profile)) continue;

    const ctx = await userEmail(admin, prop.owner_id);
    if (!ctx) continue;

    const body = `
      <h1>Give "${prop.title}" more visibility</h1>
      <p>Hi ${ctx.name}, your listing in <strong>${prop.neighborhood}</strong> has ${prop.views ?? 0} views after a week online.</p>
      <p>A listing boost puts your home at the top of neighbourhood search results for 7 days.</p>
      <p><a class="btn" href="${getSiteUrl()}/landlord/boost?propertyId=${prop.id}&ref=boost_nudge">Boost this listing</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: tplId,
      subject: `Low views on ${prop.neighborhood} listing — try a boost`,
      text: "Boost your listing",
      html: baseLayout({ preheader: "Boost suggestion", body }),
    });
    await markSent(admin, prop.owner_id, tplId);
    seenOwners.add(prop.owner_id);
    stats.sent += 1;
    if (stats.sent >= 40) break;
  }

  return stats;
}

/** Run all behaviour-driven sales emails (daily). */
export async function runSalesBotCron(admin: Admin) {
  const [upgrade, searchNoUnlock, landlord, boost] = await Promise.all([
    runUpgradeNudgeCron(admin).catch((e) => {
      console.warn("[sales] upgrade nudge:", e);
      return { sent: 0 };
    }),
    runSearchNoUnlockCron(admin).catch((e) => {
      console.warn("[sales] search no unlock:", e);
      return { sent: 0 };
    }),
    runLandlordUpsellCron(admin).catch((e) => {
      console.warn("[sales] landlord upsell:", e);
      return { sent: 0 };
    }),
    runBoostSuggestionCron(admin).catch((e) => {
      console.warn("[sales] boost suggestion:", e);
      return { sent: 0 };
    }),
  ]);
  return { upgrade, searchNoUnlock, landlord, boost };
}
