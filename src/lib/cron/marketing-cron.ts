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
  return { email, name };
}

function marketingOptIn(profile: { email_marketing_opt_in?: boolean | null } | null): boolean {
  return profile?.email_marketing_opt_in !== false;
}

export async function runTrialReminderCron(admin: Admin) {
  const stats = { trialEnding: 0, trialExpired: 0 };
  const now = new Date();
  const in3days = new Date(now);
  in3days.setDate(in3days.getDate() + 3);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, trial_ends_at, trial_unlocks_remaining, tenant_plan")
    .not("trial_ends_at", "is", null)
    .eq("tenant_plan", "free");

  for (const p of profiles ?? []) {
    if (!p.trial_ends_at) continue;
    const ends = new Date(p.trial_ends_at);
    const tplId = `trial-ending-${p.trial_ends_at.slice(0, 10)}`;
    const ctx = await userEmail(admin, p.id);
    if (!ctx) continue;

    if (ends > now && ends <= in3days && !(await alreadySent(admin, p.id, tplId))) {
      const body = `
        <h1>Your free trial ends soon</h1>
        <p>Hi ${ctx.name}, your NyumbaSearch trial ends on <strong>${ends.toLocaleDateString("en-KE")}</strong>.</p>
        <p>You have <strong>${p.trial_unlocks_remaining ?? 0}</strong> free contact unlocks remaining.</p>
        <p><a class="btn" href="${getSiteUrl()}/tenant/checkout?plan=plus">Upgrade to Plus</a></p>
      `;
      await sendEmail({
        to: ctx.email,
        templateId: "trial-ending",
        subject: "Your free trial ends in 3 days",
        text: `Trial ends ${ends.toLocaleDateString("en-KE")}`,
        html: baseLayout({ preheader: "Trial ending soon", body }),
      });
      await markSent(admin, p.id, tplId);
      stats.trialEnding += 1;
    }

    if (ends < now) {
      const expiredTpl = `trial-expired-${p.trial_ends_at.slice(0, 10)}`;
      if (!(await alreadySent(admin, p.id, expiredTpl))) {
        const body = `
          <h1>Your trial has ended</h1>
          <p>Hi ${ctx.name}, your NyumbaSearch trial ended. Upgrade to Plus for unlimited unlocks and messaging.</p>
          <p><a class="btn" href="${getSiteUrl()}/tenant/checkout?plan=plus">Get Plus — ${formatKes(PLUS_PLAN.monthlyKes)}/mo</a></p>
        `;
        await sendEmail({
          to: ctx.email,
          templateId: "trial-expired",
          subject: "Your NyumbaSearch trial has ended",
          text: "Trial ended — resubscribe to Plus",
          html: baseLayout({ preheader: "Trial ended", body }),
        });
        await markSent(admin, p.id, expiredTpl);
        stats.trialExpired += 1;
      }
    }
  }

  return stats;
}

export async function runReengagementCron(admin: Admin) {
  const stats = { sent: 0 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email_marketing_opt_in")
    .limit(500);

  for (const p of profiles ?? []) {
    if (!marketingOptIn(p)) continue;
    const tplId = `re-engagement-${new Date().toISOString().slice(0, 7)}`;
    if (await alreadySent(admin, p.id, tplId)) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("updated_at")
      .eq("id", p.id)
      .maybeSingle();

    const lastActive = profile?.updated_at ? new Date(profile.updated_at) : new Date(0);
    if (lastActive > cutoff) continue;

    const ctx = await userEmail(admin, p.id);
    if (!ctx) continue;

    const { count: newListings } = await admin
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .gte("created_at", cutoff.toISOString());

    const body = `
      <h1>Still looking for a home in Nairobi?</h1>
      <p>Hi ${ctx.name}, <strong>${newListings ?? 0}</strong> new listings were added since your last visit.</p>
      <p><a class="btn" href="${getSiteUrl()}/tenant">Browse homes</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: "re-engagement",
      subject: "Still looking for a home in Nairobi?",
      text: `${newListings} new listings waiting`,
      html: baseLayout({ preheader: "New listings in Nairobi", body }),
    });
    await markSent(admin, p.id, tplId);
    stats.sent += 1;
  }

  return stats;
}

export async function runWeeklyDigestCron(admin: Admin) {
  const stats = { sent: 0 };
  const weekKey = `weekly-digest-${new Date().toISOString().slice(0, 10)}`;
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: hoodCounts } = await admin
    .from("properties")
    .select("neighborhood")
    .eq("is_active", true)
    .gte("created_at", since.toISOString());

  const byHood = new Map<string, number>();
  for (const row of hoodCounts ?? []) {
    byHood.set(row.neighborhood, (byHood.get(row.neighborhood) ?? 0) + 1);
  }

  const topHoods = [...byHood.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!topHoods.length) return stats;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email_marketing_opt_in")
    .eq("tenant_plan", "free")
    .limit(300);

  for (const p of profiles ?? []) {
    if (!marketingOptIn(p)) continue;
    if (await alreadySent(admin, p.id, weekKey)) continue;
    const ctx = await userEmail(admin, p.id);
    if (!ctx) continue;

    const hoodLines = topHoods
      .map(([h, c]) => `<li>${h}: ${c} new listing${c === 1 ? "" : "s"}</li>`)
      .join("");
    const body = `
      <h1>This week in Nairobi rentals</h1>
      <p>Hi ${ctx.name}, here's what's new:</p>
      <ul>${hoodLines}</ul>
      <p><a class="btn" href="${getSiteUrl()}/tenant/map">Explore on map</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: "weekly-digest",
      subject: `This week in Nairobi — ${topHoods.reduce((s, [, c]) => s + c, 0)} new listings`,
      text: "Weekly Nairobi rental digest",
      html: baseLayout({ preheader: "Weekly neighbourhood digest", body }),
    });
    await markSent(admin, p.id, weekKey);
    stats.sent += 1;
  }

  return stats;
}

export async function runMonthlyMarketTeaserCron(admin: Admin) {
  const stats = { sent: 0 };
  const monthKey = `market-teaser-${new Date().toISOString().slice(0, 7)}`;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email_marketing_opt_in")
    .limit(500);

  for (const p of profiles ?? []) {
    if (!marketingOptIn(p)) continue;
    if (await alreadySent(admin, p.id, monthKey)) continue;
    const ctx = await userEmail(admin, p.id);
    if (!ctx) continue;

    const body = `
      <h1>Nairobi rental market report</h1>
      <p>Hi ${ctx.name}, our monthly market report is ready with neighbourhood trends and price shifts.</p>
      <p><a class="btn" href="${getSiteUrl()}/reports">View teaser &amp; buy full report</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: "market-report-teaser",
      subject: `Nairobi rental market — ${new Date().toLocaleString("en-KE", { month: "long", year: "numeric" })}`,
      text: "Monthly market report teaser",
      html: baseLayout({ preheader: "Monthly market report", body }),
    });
    await markSent(admin, p.id, monthKey);
    stats.sent += 1;
  }

  return stats;
}

export async function runSavedSearchDigestCron(admin: Admin) {
  const stats = { sent: 0 };
  const since = new Date();
  since.setDate(since.getDate() - 1);

  const { data: searches } = await admin
    .from("saved_searches")
    .select("*")
    .eq("alert_enabled", true);

  for (const search of searches ?? []) {
    const criteria = (search.criteria ?? search.filters ?? {}) as {
      neighborhood?: string;
      maxBudget?: number;
      propertyType?: string;
    };
    const notifiedSince = search.last_notified_at ?? since.toISOString();

    let query = admin
      .from("properties")
      .select("id, title, neighborhood, rent_kes")
      .eq("is_active", true)
      .gte("created_at", notifiedSince);

    if (criteria.neighborhood) query = query.ilike("neighborhood", `%${criteria.neighborhood}%`);
    if (criteria.maxBudget) query = query.lte("rent_kes", criteria.maxBudget);
    if (criteria.propertyType) query = query.eq("property_type", criteria.propertyType);

    const { data: matches } = await query.limit(5);
    if (!matches?.length) continue;

    const ctx = await userEmail(admin, search.user_id);
    if (!ctx) continue;

    const cards = matches
      .map(
        (m) =>
          `<p><a href="${getSiteUrl()}/tenant/property/${m.id}"><strong>${m.title}</strong></a> — ${m.neighborhood}, ${formatKes(m.rent_kes)}</p>`,
      )
      .join("");
    const body = `
      <h1>${matches.length} new homes match "${search.name}"</h1>
      ${cards}
      <p><a class="btn" href="${getSiteUrl()}/tenant">See all matches</a></p>
    `;
    await sendEmail({
      to: ctx.email,
      templateId: "saved-search-alert",
      subject: `${matches.length} new homes match your search`,
      text: `${matches.length} new matches`,
      html: baseLayout({ preheader: "New listing matches", body }),
    });
    await admin
      .from("saved_searches")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", search.id);
    stats.sent += 1;
  }

  return stats;
}
