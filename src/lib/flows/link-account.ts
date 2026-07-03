import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendEmail } from "@/lib/email/send";
import { sendText } from "@/lib/whatsapp/client";
import { saveSession, updateState } from "@/lib/whatsapp/session";
import type { WaSession } from "@/lib/whatsapp/types";
import {
  formatProfileDigest,
  getCachedUserProfile,
  inferPrimaryWaRole,
} from "@/lib/whatsapp/user-profile";

type Admin = SupabaseClient<Database>;

export async function findUserByEmail(
  admin: Admin,
  email: string,
): Promise<{ id: string; fullName: string } | null> {
  const normalized = email.toLowerCase().trim();
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", match.id)
        .maybeSingle();
      return {
        id: match.id,
        fullName: profile?.full_name ?? match.user_metadata?.full_name ?? "there",
      };
    }
    if (data.users.length < 100) break;
    page += 1;
  }
  return null;
}

async function sendOtpEmail(email: string, name: string, otp: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your NyumbaSearch WhatsApp verification code",
    text: `Hi ${name},\n\nYour verification code is: ${otp}\n\nIt expires in 15 minutes.\n\n— NyumbaSearch`,
    html: `<p>Hi ${name},</p><p>Your verification code is: <strong>${otp}</strong></p><p>It expires in 15 minutes.</p><p>— NyumbaSearch</p>`,
    templateId: "whatsapp_link_otp",
    metadata: { purpose: "whatsapp_link" },
  });
}

export async function handleAccountLinkEmail(
  admin: Admin,
  waPhone: string,
  email: string,
): Promise<void> {
  const user = await findUserByEmail(admin, email);
  if (!user) {
    await sendText(
      waPhone,
      "No account found with that email. Create an account at nyumbasearch.com/register first, then come back.",
      admin,
    );
    return;
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await admin.from("whatsapp_otp").upsert({
    wa_phone: waPhone,
    otp,
    user_id: user.id,
    expires_at: expiresAt,
  });

  await sendOtpEmail(email, user.fullName.split(" ")[0] ?? "there", otp);
  await sendText(
    waPhone,
    `📧 A 6-digit verification code has been sent to *${email}*.\n\nEnter the code here to link your account:`,
    admin,
  );
  await updateState(admin, waPhone, "account_link_otp");
}

export async function handleAccountLinkOtp(
  admin: Admin,
  waPhone: string,
  code: string,
  session: WaSession,
): Promise<void> {
  const { data: stored } = await admin
    .from("whatsapp_otp")
    .select("otp, user_id, expires_at")
    .eq("wa_phone", waPhone)
    .maybeSingle();

  if (!stored || new Date(stored.expires_at) < new Date()) {
    await sendText(waPhone, "That code has expired. Type your email to try again:", admin);
    await updateState(admin, waPhone, "account_link_email");
    return;
  }

  if (code.replace(/\s/g, "") !== stored.otp) {
    await sendText(waPhone, "That code is incorrect. Please try again:", admin);
    return;
  }

  session.userId = stored.user_id;
  if (session.role === "unknown") {
    const profile = await getCachedUserProfile(admin, session, true);
    session.role = profile
      ? inferPrimaryWaRole(profile.roles, {
          hasProviderProfile: Boolean(profile.providerBusiness),
          hasListings: profile.activeListings + profile.pendingListings > 0,
        })
      : "tenant";
  }
  await saveSession(admin, session);

  await admin.from("profiles").update({ phone: waPhone }).eq("id", stored.user_id);
  await admin.from("whatsapp_link_events").insert({
    wa_phone: waPhone,
    user_id: stored.user_id,
  });
  await admin.from("whatsapp_otp").delete().eq("wa_phone", waPhone);

  const profile = await getCachedUserProfile(admin, session, true);
  if (profile) {
    await sendText(
      waPhone,
      `✅ *Account linked!*\n\n${formatProfileDigest(profile)}\n\nI'm now your personal NyumbaSearch assistant. Reply *MENU* anytime.`,
      admin,
    );
    await updateState(admin, waPhone, "personal_home");
    return;
  }

  await sendText(waPhone, "✅ *Account linked!* Reply *MENU* to continue.", admin);
  await updateState(admin, waPhone, `${session.role}_menu`);
}

export async function promptAccountLink(admin: Admin, waPhone: string): Promise<void> {
  await sendText(
    waPhone,
    "Please link your NyumbaSearch account first. Type your registered email:",
    admin,
  );
  await updateState(admin, waPhone, "account_link_email");
}

export async function tryResolveSessionUser(
  admin: Admin,
  session: WaSession,
): Promise<string | null> {
  if (session.userId) return session.userId;
  const byPhone = await admin
    .from("profiles")
    .select("id")
    .eq("phone", session.waPhone)
    .maybeSingle();
  if (byPhone.data?.id) {
    session.userId = byPhone.data.id;
    await saveSession(admin, session);
    return byPhone.data.id;
  }
  return null;
}
