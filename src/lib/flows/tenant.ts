import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { initiateStkPush, isMpesaConfigured } from "@/lib/api/mpesa";
import { syncMpesaPaymentStatus } from "@/lib/payments/complete-mpesa-payment";
import { unlockFeeForRent } from "@/lib/payments/unlock-pricing";
import { ensureTenantTrial } from "@/lib/payments/tenant-trial";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";
import { notifyContactUnlockEmails } from "@/lib/email/contact-unlock-notify";
import { getSiteUrl } from "@/lib/site";
import {
  handleAccountLinkEmail,
  handleAccountLinkOtp,
  promptAccountLink,
  tryResolveSessionUser,
} from "@/lib/flows/link-account";
import { sendSavedHomes, sendMyViewings, sendAccountStatus } from "@/lib/flows/assistant";
import { callNyumbaAI } from "@/lib/flows/nyumbaai";
import { sendButtons, sendImage, sendList, sendText } from "@/lib/whatsapp/client";
import { NAIROBI_NEIGHBOURHOODS } from "@/lib/whatsapp/geocode";
import { saveSession, updateState } from "@/lib/whatsapp/session";
import type { WaInboundMessage, WaSession } from "@/lib/whatsapp/types";
import {
  displayFirstName,
  formatProfileDigest,
  invalidateProfileCache,
  refreshSessionProfile,
  type UserAssistantProfile,
} from "@/lib/whatsapp/user-profile";

type Admin = SupabaseClient<Database>;

const BUDGET_BUTTONS = [
  { id: "budget_20k", label: "Under KES 20k" },
  { id: "budget_50k", label: "Under KES 50k" },
  { id: "budget_100k", label: "Under KES 100k" },
] as const;

function sessionContextString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function verificationBadge(isVerified: boolean, score: number): string {
  if (isVerified) return "🟢";
  if (score >= 70) return "🔵";
  return "⚪";
}

function formatPhoneDisplay(phone254: string): string {
  const local = phone254.startsWith("254") ? `0${phone254.slice(3)}` : phone254;
  return local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}

function normalizeMpesaPhone(input: string, waPhone: string): string {
  let phone = input === "use_wa_phone" ? waPhone : input.replace(/\s/g, "");
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`;
  if (!phone.startsWith("254")) phone = `254${phone}`;
  return phone;
}

function runInBackground(task: Promise<unknown>): void {
  task.catch((err) => console.warn("Background task failed:", err));
}

function formatUnlockTrialNote(
  method: "plus" | "trial",
  remaining: number | null | undefined,
): string {
  if (method === "trial" && remaining != null) {
    const suffix = remaining === 1 ? "" : "s";
    return `\n\n_${remaining} free unlock${suffix} remaining._`;
  }
  if (method === "plus") {
    return "\n\n✨ _Included with your Plus subscription._";
  }
  return "";
}

function isoDateOffset(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split("T")[0] ?? "";
}

async function resolveContactPhone(admin: Admin, listingId: string): Promise<string | null> {
  const { data: property } = await admin
    .from("properties")
    .select("contact_phone, owner_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!property) return null;
  if (property.contact_phone?.trim()) return property.contact_phone.trim();
  if (!property.owner_id) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", property.owner_id)
    .maybeSingle();
  return profile?.phone?.trim() ?? null;
}

async function unlockFreeAndReveal(
  admin: Admin,
  waPhone: string,
  userId: string,
  listingId: string,
  method: "plus" | "trial",
  session: WaSession,
): Promise<void> {
  const contact = await resolveContactPhone(admin, listingId);
  const { data: property } = await admin
    .from("properties")
    .select("title, neighborhood")
    .eq("id", listingId)
    .maybeSingle();

  const { data: existing } = await admin
    .from("contact_unlocks")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (!existing) {
    if (method === "trial") {
      const trial = await ensureTenantTrial(admin, userId);
      if (trial.trialUnlocksRemaining > 0) {
        await admin
          .from("profiles")
          .update({ trial_unlocks_remaining: trial.trialUnlocksRemaining - 1 })
          .eq("id", userId)
          .gt("trial_unlocks_remaining", 0);
      }
    }
    await admin.from("contact_unlocks").insert({
      user_id: userId,
      listing_id: listingId,
      method,
      fee_charged: 0,
    });
    runInBackground(notifyContactUnlockEmails(admin, { userId, listingId, method, feeKes: 0 }));
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("trial_unlocks_remaining")
    .eq("id", userId)
    .maybeSingle();

  const trialNote = formatUnlockTrialNote(method, profile?.trial_unlocks_remaining);

  await sendText(
    waPhone,
    `✅ *Contact unlocked!*\n\n📞 *Landlord contact:*\n\n*${contact ?? "Not available"}*\n\nFor ${property?.title ?? "this listing"} in ${property?.neighborhood ?? "Nairobi"}.${trialNote}`,
    admin,
  );
  invalidateProfileCache(session);
  await saveSession(admin, session);
}

export async function pollUnlockPayment(
  admin: Admin,
  waPhone: string,
  paymentId: string,
  listingId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 18; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));

    const { data: payment } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment) continue;

    if (payment.status === "failed") {
      await sendButtons(
        waPhone,
        "❌ Payment was not completed. Try again?",
        [
          { id: `unlock_${listingId}`, label: "🔄 Try again" },
          { id: "tenant_menu", label: "🏠 Main menu" },
        ],
        admin,
      );
      await updateState(admin, waPhone, "tenant_menu");
      return;
    }

    let status = payment.status;
    if (status === "pending") {
      const synced = await syncMpesaPaymentStatus(admin, payment);
      status = synced.status;
    }

    if (status === "completed") {
      const contact = await resolveContactPhone(admin, listingId);
      const { data: property } = await admin
        .from("properties")
        .select("title, neighborhood")
        .eq("id", listingId)
        .maybeSingle();
      await sendText(
        waPhone,
        `✅ *Payment confirmed!*\n\n📞 *${contact ?? "Not available"}*\n\n${property?.title ?? ""} · ${property?.neighborhood ?? ""}`,
        admin,
      );
      await updateState(admin, waPhone, "tenant_menu");
      return;
    }

    if (attempt === 6)
      await sendText(waPhone, "⏳ Still waiting for M-Pesa confirmation...", admin);
    if (attempt === 12)
      await sendText(waPhone, "⏳ Complete the M-Pesa prompt on your phone.", admin);
  }

  await sendButtons(
    waPhone,
    "⌛ Payment expired. Try again.",
    [
      { id: `unlock_${listingId}`, label: "🔄 Try again" },
      { id: "tenant_menu", label: "🏠 Main menu" },
    ],
    admin,
  );
  await updateState(admin, waPhone, "tenant_menu");
}

function buildMenuHints(profile: UserAssistantProfile): string[] {
  const hints: string[] = [];
  if (profile.isPlus) hints.push("Plus member ✨");
  else if (profile.trialActive) hints.push(`${profile.trialUnlocksRemaining} free unlocks`);
  if (profile.savedCount > 0) hints.push(`${profile.savedCount} saved`);
  if (profile.upcomingViewings.length > 0)
    hints.push(`${profile.upcomingViewings.length} viewing(s) soon`);
  if (profile.lastSearchArea) hints.push(`Last: ${profile.lastSearchArea}`);
  return hints;
}

async function showTenantMenu(
  admin: Admin,
  waPhone: string,
  firstName: string,
  profile: UserAssistantProfile | null | undefined,
): Promise<void> {
  if (profile) {
    const hints = buildMenuHints(profile);
    const intro = formatProfileDigest(profile);
    const hintLine = hints.length ? `\n_${hints.join(" · ")}_` : "";
    const rows = [
      { id: "search_start", title: "Search homes", description: "Find verified rentals" },
      { id: "saved_homes", title: "Saved homes", description: `${profile.savedCount} saved` },
      { id: "my_viewings", title: "My viewings", description: "Upcoming appointments" },
      { id: "nyumbaai_start", title: "Ask NyumbaAI", description: "Personal advice" },
      { id: "my_status", title: "My account", description: "Plan & unlocks" },
    ];
    if (profile.lastSearchArea) {
      rows.push({
        id: "search_repeat",
        title: `Search ${profile.lastSearchArea}`,
        description: "Repeat last area",
      });
    }
    await sendList(
      waPhone,
      `${intro}${hintLine}\n\nYour personal search assistant — what next?`,
      "Menu",
      [{ title: "Tenant", rows: rows.slice(0, 10) }],
      admin,
    );
  } else {
    await sendButtons(
      waPhone,
      `Hi ${firstName} 👋\n\nWhat would you like to do?`,
      [
        { id: "search_start", label: "🔍 Search homes" },
        { id: "nyumbaai_start", label: "🤖 Ask NyumbaAI" },
        { id: "tenant_account", label: "👤 Link account" },
      ],
      admin,
    );
  }
  await updateState(admin, waPhone, "tenant_menu");
}

async function promptSearchArea(admin: Admin, waPhone: string): Promise<void> {
  await sendList(
    waPhone,
    "📍 Which neighbourhood?",
    "Choose area",
    [
      {
        title: "Popular",
        rows: NAIROBI_NEIGHBOURHOODS.slice(0, 10).map((n) => ({
          id: `area_${n.replace(/[^a-zA-Z]/g, "").toLowerCase()}`,
          title: n,
          description: `Homes in ${n}`,
        })),
      },
      {
        title: "More",
        rows: NAIROBI_NEIGHBOURHOODS.slice(10).map((n) => ({
          id: `area_${n.replace(/[^a-zA-Z]/g, "").toLowerCase()}`,
          title: n,
          description: `Homes in ${n}`,
        })),
      },
    ],
    admin,
  );
  await updateState(admin, waPhone, "search_area");
}

async function handleSearchAreaInput(
  admin: Admin,
  waPhone: string,
  input: string,
): Promise<boolean> {
  if (!input.startsWith("area_")) return false;
  const key = input.replace("area_", "");
  const area =
    NAIROBI_NEIGHBOURHOODS.find((n) => n.replace(/[^a-zA-Z]/g, "").toLowerCase() === key) ?? input;
  await updateState(admin, waPhone, "search_budget", { searchArea: area });
  await sendButtons(waPhone, `Searching in *${area}*. Max budget?`, [...BUDGET_BUTTONS], admin);
  return true;
}

async function handleSearchBudgetStep(admin: Admin, waPhone: string, input: string): Promise<void> {
  const budgetMap: Record<string, number> = {
    budget_20k: 20000,
    budget_50k: 50000,
    budget_100k: 100000,
  };
  let maxBudget = budgetMap[input];
  if (!maxBudget && /^\d+$/.test(input)) maxBudget = Number.parseInt(input, 10);
  if (!maxBudget) {
    await sendText(waPhone, "Choose a budget or type amount in KES.", admin);
    return;
  }
  await updateState(admin, waPhone, "search_beds", { maxBudget });
  await sendList(
    waPhone,
    `Budget KES ${maxBudget.toLocaleString()}/mo. Bedrooms?`,
    "Choose",
    [
      {
        title: "Bedrooms",
        rows: [
          { id: "beds_0", title: "Bedsitter", description: "Studio" },
          { id: "beds_1", title: "1 Bedroom", description: "1BR" },
          { id: "beds_2", title: "2 Bedrooms", description: "2BR" },
          { id: "beds_3", title: "3 Bedrooms", description: "3BR" },
          { id: "beds_any", title: "Any", description: "All" },
        ],
      },
    ],
    admin,
  );
}

async function handleSearchBedsStep(
  admin: Admin,
  waPhone: string,
  input: string,
  session: WaSession,
): Promise<void> {
  const bedsMap: Record<string, number | null> = {
    beds_0: 0,
    beds_1: 1,
    beds_2: 2,
    beds_3: 3,
    beds_any: null,
  };
  if (!(input in bedsMap)) {
    await sendText(waPhone, "Choose bedrooms from the list.", admin);
    return;
  }

  const bedrooms = bedsMap[input];
  const searchArea = sessionContextString(session.context.searchArea);
  const maxBudget = Number(session.context.maxBudget ?? 0);

  let query = admin
    .from("properties")
    .select("id, title, rent_kes, bedrooms, neighborhood, is_verified, authenticity_score, images")
    .eq("is_active", true)
    .ilike("neighborhood", searchArea)
    .lte("rent_kes", maxBudget)
    .order("is_verified", { ascending: false })
    .limit(5);
  if (bedrooms !== null) query = query.eq("bedrooms", bedrooms);

  const { data: listings } = await query;
  if (!listings?.length) {
    await sendButtons(
      waPhone,
      `No listings in *${searchArea}* under KES ${maxBudget.toLocaleString()}.`,
      [
        { id: "search_start", label: "🔁 Search again" },
        { id: "nyumbaai_start", label: "🤖 NyumbaAI" },
      ],
      admin,
    );
    await updateState(admin, waPhone, "tenant_menu");
    return;
  }

  await sendText(waPhone, `✅ Found *${listings.length}* in ${searchArea}:`, admin);
  for (const l of listings) {
    const badge = verificationBadge(l.is_verified, l.authenticity_score ?? 0);
    const br = l.bedrooms === 0 ? "Bedsitter" : `${l.bedrooms}BR`;
    await sendButtons(
      waPhone,
      `${badge} *${l.title}*\n📍 ${l.neighborhood}\n🛏 ${br}  💰 KES ${l.rent_kes.toLocaleString()}/mo`,
      [
        { id: `view_${l.id}`, label: "👁 Details" },
        { id: `unlock_${l.id}`, label: "📞 Contact" },
      ],
      admin,
    );
    await new Promise((r) => setTimeout(r, 400));
  }
  await sendText(waPhone, `More: ${getSiteUrl()}/tenant · *MENU* to go back`, admin);
  await updateState(admin, waPhone, "search_results");
}

async function showListingDetail(admin: Admin, waPhone: string, listingId: string): Promise<void> {
  const { data: listing } = await admin
    .from("properties")
    .select("*")
    .eq("id", listingId)
    .eq("is_active", true)
    .maybeSingle();
  if (!listing) {
    await sendText(waPhone, "Listing no longer available.", admin);
    return;
  }
  const badge = verificationBadge(listing.is_verified, listing.authenticity_score ?? 0);
  if (listing.images?.[0]) {
    await sendImage(
      waPhone,
      listing.images[0],
      `${listing.title} — KES ${listing.rent_kes.toLocaleString()}`,
      admin,
    );
  }
  await sendButtons(
    waPhone,
    `${badge} *${listing.title}*\n📍 ${listing.neighborhood}\n💰 KES ${listing.rent_kes.toLocaleString()}/mo\n\n${(listing.description ?? "").slice(0, 250)}`,
    [
      { id: `unlock_${listing.id}`, label: "📞 Get contact" },
      { id: `viewing_${listing.id}`, label: "📅 Book viewing" },
    ],
    admin,
  );
}

async function handleUnlockRequest(
  admin: Admin,
  waPhone: string,
  session: WaSession,
  listingId: string,
): Promise<void> {
  const userId = await tryResolveSessionUser(admin, session);

  if (userId) {
    const { data: existing } = await admin
      .from("contact_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", listingId)
      .maybeSingle();
    if (existing) {
      const contact = await resolveContactPhone(admin, listingId);
      await sendText(waPhone, `✅ Already unlocked.\n\n📞 *${contact ?? "N/A"}*`, admin);
      return;
    }
    const plus = await getTenantPlusStatus(admin, userId);
    if (plus.tenantPlan === "plus") {
      await unlockFreeAndReveal(admin, waPhone, userId, listingId, "plus", session);
      return;
    }
    const trial = await ensureTenantTrial(admin, userId);
    if (trial.trialActive && trial.trialUnlocksRemaining > 0) {
      await unlockFreeAndReveal(admin, waPhone, userId, listingId, "trial", session);
      return;
    }
  } else {
    await updateState(admin, waPhone, "account_link_email", { pendingUnlockId: listingId });
    await sendText(
      waPhone,
      "Link your account to unlock contacts. Type your registered email:",
      admin,
    );
    return;
  }

  const { data: property } = await admin
    .from("properties")
    .select("rent_kes, title, neighborhood")
    .eq("id", listingId)
    .maybeSingle();
  if (!property) return;
  const fee = unlockFeeForRent(property.rent_kes);
  await updateState(admin, waPhone, "unlock_mpesa_number", {
    unlockListingId: listingId,
    unlockFee: fee,
  });
  await sendButtons(
    waPhone,
    `Unlock *${property.title}* — KES ${fee} via M-Pesa`,
    [{ id: "use_wa_phone", label: `Use ${formatPhoneDisplay(waPhone)}` }],
    admin,
  );
}

async function handleUnlockMpesaStep(
  admin: Admin,
  waPhone: string,
  input: string,
  session: WaSession,
): Promise<void> {
  const mpesaPhone = normalizeMpesaPhone(input, waPhone);
  if (!/^254[17]\d{8}$/.test(mpesaPhone)) {
    await sendText(waPhone, "Invalid number. Example: 0712 345 678", admin);
    return;
  }
  const listingId = sessionContextString(session.context.unlockListingId);
  const fee = Number(session.context.unlockFee ?? 0);
  const userId = await tryResolveSessionUser(admin, session);
  if (!userId || !listingId) {
    await sendText(waPhone, "Session expired. *MENU* to restart.", admin);
    return;
  }
  if (!isMpesaConfigured()) {
    await sendText(waPhone, "M-Pesa unavailable. Use nyumbasearch.com", admin);
    return;
  }
  await sendText(waPhone, `💳 M-Pesa prompt sent to ${mpesaPhone}. Pay KES ${fee}.`, admin);
  try {
    const stk = await initiateStkPush({
      phone254: mpesaPhone,
      amountKes: fee,
      accountReference: "NSUnlock",
      transactionDesc: "Contact unlock",
    });
    const paymentId = crypto.randomUUID();
    await admin.from("payments").insert({
      id: paymentId,
      user_id: userId,
      amount_kes: fee,
      payment_type: "contact_unlock",
      property_id: listingId,
      status: "pending",
      payment_method: "mpesa",
      mpesa_phone: mpesaPhone,
      mpesa_checkout_id: stk.checkoutRequestId,
      idempotency_key: crypto.randomUUID(),
      metadata: { source: "whatsapp", wa_phone: waPhone },
    });
    runInBackground(pollUnlockPayment(admin, waPhone, paymentId, listingId));
  } catch {
    await sendButtons(
      waPhone,
      "M-Pesa failed. Try again?",
      [
        { id: `unlock_${listingId}`, label: "🔄 Retry" },
        { id: "tenant_menu", label: "🏠 Menu" },
      ],
      admin,
    );
  }
}

async function promptViewingDates(admin: Admin, waPhone: string, listingId: string): Promise<void> {
  await updateState(admin, waPhone, "schedule_date", { viewingListingId: listingId });
  const rows = [];
  for (let d = 1; d <= 7; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    const iso = isoDateOffset(d);
    rows.push({
      id: `date_${iso}`,
      title: date.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" }),
      description: d === 1 ? "Tomorrow" : `In ${d}d`,
    });
  }
  await sendList(waPhone, "📅 Pick a date:", "Dates", [{ title: "Next 7 days", rows }], admin);
}

async function handleViewingTimeStep(
  admin: Admin,
  waPhone: string,
  input: string,
  session: WaSession,
): Promise<void> {
  const time = input.replace("time_", "");
  const listingId = sessionContextString(session.context.viewingListingId);
  const viewingDate = sessionContextString(session.context.viewingDate);
  const userId = await tryResolveSessionUser(admin, session);
  if (!userId) {
    await updateState(admin, waPhone, "account_link_email", {
      viewingListingId: listingId,
      viewingDate,
      viewingTime: time,
    });
    await sendText(waPhone, "Link account to confirm viewing. Type your email:", admin);
    return;
  }
  const { data: property } = await admin
    .from("properties")
    .select("owner_id, title")
    .eq("id", listingId)
    .maybeSingle();
  if (!property?.owner_id) {
    await sendText(waPhone, "Viewing not available for this listing.", admin);
    return;
  }
  await admin.from("viewings").insert({
    property_id: listingId,
    tenant_id: userId,
    landlord_id: property.owner_id,
    scheduled_at: `${viewingDate}T${time}:00`,
    status: "pending",
    notes: "WhatsApp",
  });
  await sendText(
    waPhone,
    `✅ Viewing requested: ${property.title} on ${viewingDate} at ${time}`,
    admin,
  );
  await refreshSessionProfile(admin, session);
  await updateState(admin, waPhone, "tenant_menu");
}

async function handleNyumbaAiMode(
  admin: Admin,
  waPhone: string,
  input: string,
  session: WaSession,
  profile: UserAssistantProfile | null | undefined,
): Promise<void> {
  if (input === "nyumbaai_start") {
    const aiIntro = profile
      ? `🤖 *NyumbaAI* — Hi ${profile.firstName}! I know your account — ask about your saved homes, viewings, or any Nairobi rental question.\n\n*MENU* to go back.`
      : "🤖 *NyumbaAI* — Ask me anything about renting in Nairobi.\n\n*MENU* to go back.";
    await sendText(waPhone, aiIntro, admin);
    await updateState(admin, waPhone, "nyumbaai_mode", { aiHistory: [] });
    return;
  }

  const history = (session.context.aiHistory as { role: string; content: string }[]) ?? [];
  const reply = await callNyumbaAI(input, history, profile);
  const updated = [
    ...history,
    { role: "user", content: input },
    { role: "assistant", content: reply },
  ].slice(-20);
  await updateState(admin, waPhone, "nyumbaai_mode", { aiHistory: updated });
  await sendButtons(
    waPhone,
    `🤖 ${reply}`,
    [
      { id: "nyumbaai_start", label: "🔄 Another" },
      { id: "search_start", label: "🔍 Search" },
    ],
    admin,
  );
}

async function handleScheduleDateStep(admin: Admin, waPhone: string, input: string): Promise<void> {
  const date = input.replace("date_", "");
  await updateState(admin, waPhone, "schedule_time", { viewingDate: date });
  const times = ["08:00", "10:00", "12:00", "14:00", "16:00", "17:00"];
  await sendList(
    waPhone,
    `Date: ${date}. Pick time:`,
    "Times",
    [{ title: "Times", rows: times.map((t) => ({ id: `time_${t}`, title: t })) }],
    admin,
  );
}

type TenantFlowContext = {
  admin: Admin;
  waPhone: string;
  session: WaSession;
  input: string;
  profile?: UserAssistantProfile | null;
  firstName: string;
};

async function tryProfileCommands(ctx: TenantFlowContext): Promise<boolean> {
  const { admin, waPhone, input, profile } = ctx;
  if (input === "saved_homes" && profile) {
    await sendSavedHomes(admin, waPhone, profile);
    return true;
  }
  if (input === "my_viewings" && profile) {
    await sendMyViewings(admin, waPhone, profile);
    return true;
  }
  if ((input === "my_status" || input === "tenant_account") && profile) {
    await sendAccountStatus(admin, waPhone, profile);
    return true;
  }
  if (input === "tenant_account") {
    const userId = await tryResolveSessionUser(admin, ctx.session);
    if (!userId) {
      await promptAccountLink(admin, waPhone);
      return true;
    }
    if (profile) await sendAccountStatus(admin, waPhone, profile);
    else await sendText(waPhone, `👤 Account linked.\n\n${getSiteUrl()}/tenant`, admin);
    return true;
  }
  return false;
}

async function trySearchFlow(ctx: TenantFlowContext): Promise<boolean> {
  const { admin, waPhone, input, profile, session } = ctx;
  if (session.state === "tenant_menu" || input === "tenant_menu") {
    await showTenantMenu(admin, waPhone, ctx.firstName, profile);
    return true;
  }
  if (input === "search_repeat" && profile?.lastSearchArea) {
    await updateState(admin, waPhone, "search_budget", { searchArea: profile.lastSearchArea });
    await sendButtons(
      waPhone,
      `Searching in *${profile.lastSearchArea}* again. Max budget?`,
      [...BUDGET_BUTTONS],
      admin,
    );
    return true;
  }
  if (input === "search_start") {
    await promptSearchArea(admin, waPhone);
    return true;
  }
  if (session.state === "search_area" && (await handleSearchAreaInput(admin, waPhone, input))) {
    return true;
  }
  if (session.state === "search_budget") {
    await handleSearchBudgetStep(admin, waPhone, input);
    return true;
  }
  if (session.state === "search_beds") {
    await handleSearchBedsStep(admin, waPhone, input, session);
    return true;
  }
  return false;
}

async function tryListingActions(ctx: TenantFlowContext): Promise<boolean> {
  const { admin, waPhone, input, session } = ctx;
  if (input.startsWith("view_")) {
    await showListingDetail(admin, waPhone, input.replace("view_", ""));
    return true;
  }
  if (input.startsWith("unlock_")) {
    await handleUnlockRequest(admin, waPhone, session, input.replace("unlock_", ""));
    return true;
  }
  if (session.state === "unlock_mpesa_number") {
    await handleUnlockMpesaStep(admin, waPhone, input, session);
    return true;
  }
  return false;
}

async function tryViewingFlow(ctx: TenantFlowContext): Promise<boolean> {
  const { admin, waPhone, input, session } = ctx;
  if (input.startsWith("viewing_")) {
    await promptViewingDates(admin, waPhone, input.replace("viewing_", ""));
    return true;
  }
  if (session.state === "schedule_date" && input.startsWith("date_")) {
    await handleScheduleDateStep(admin, waPhone, input);
    return true;
  }
  if (session.state === "schedule_time" && input.startsWith("time_")) {
    await handleViewingTimeStep(admin, waPhone, input, session);
    return true;
  }
  return false;
}

async function tryAiAndAccountFlow(ctx: TenantFlowContext): Promise<boolean> {
  const { admin, waPhone, input, session, profile } = ctx;
  if (input === "nyumbaai_start" || session.state === "nyumbaai_mode") {
    await handleNyumbaAiMode(admin, waPhone, input, session, profile);
    return true;
  }
  if (session.state === "account_link_email") {
    if (!input.includes("@")) {
      await sendText(waPhone, "Enter your NyumbaSearch email:", admin);
      return true;
    }
    await handleAccountLinkEmail(admin, waPhone, input);
    return true;
  }
  if (session.state === "account_link_otp") {
    await handleAccountLinkOtp(admin, waPhone, input, session);
    return true;
  }
  return false;
}

export async function handleTenantFlow(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  _message: WaInboundMessage,
  input: string,
  profile?: UserAssistantProfile | null,
): Promise<void> {
  const ctx: TenantFlowContext = {
    admin,
    waPhone,
    session,
    input,
    profile,
    firstName: displayFirstName(profile ?? null, senderName),
  };

  if (await tryProfileCommands(ctx)) return;
  if (await trySearchFlow(ctx)) return;
  if (await tryListingActions(ctx)) return;
  if (await tryViewingFlow(ctx)) return;
  if (await tryAiAndAccountFlow(ctx)) return;

  await sendButtons(
    waPhone,
    "What next?",
    [
      { id: "search_start", label: "🔍 Search" },
      { id: "nyumbaai_start", label: "🤖 NyumbaAI" },
      { id: "tenant_menu", label: "🏠 Menu" },
    ],
    admin,
  );
}
