import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { ORG_REQUIRED_ROLES, isPrivilegedAccountRole, type AccountRole } from "@/lib/account-roles";
import { SIGNUP_POLICY_VERSION } from "@/lib/auth/signup-policy";
import { submitPendingPortalApplicationForUser } from "@/lib/api/portal.functions";
import type { PortalListerRole } from "@/lib/payments/portal-trial";
import {
  checkRateLimit,
  rateLimitDistributed,
  rateLimitKeyFromHeaders,
  RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { asLooseDb } from "@/lib/db/loose-client";
import { passwordResetEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site";
import { isKenyanPhone } from "@/lib/phone";
import { tryClaimFoundingMemberSlot } from "@/lib/promo/claim-slot";
import { isPromoEligibleRole, PROMO_LABELS } from "@/lib/promo/constants";
import { sendFoundingMemberClaimedEmail } from "@/lib/promo/founding-member-lifecycle";
import { cacheDelete } from "@/lib/cache/manager";

const passwordResetSchema = z.object({
  email: z.string().email(),
});

const passwordResetOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const passwordResetCompleteSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: z.string().min(8).max(72),
});

/**
 * Sends a password reset email with our own exactly-6-digit code (not Supabase's OTP,
 * which may be 8 digits depending on project settings).
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator(passwordResetSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = rateLimitKeyFromHeaders(request?.headers);
    const email = data.email.trim().toLowerCase();

    checkRateLimit(`pwreset:ip:${ip}`, RATE_LIMITS.passwordReset);
    checkRateLimit(`pwreset:email:${email}`, RATE_LIMITS.passwordReset);

    try {
      const user = await findAuthUserByEmail(email);
      // Always return ok to avoid email enumeration.
      if (!user) return { ok: true as const };

      const { generateSixDigitResetCode, storePasswordResetCode } =
        await import("@/lib/auth/password-reset-store");

      const otpCode = generateSixDigitResetCode();
      await storePasswordResetCode({ email, userId: user.id, code: otpCode });

      const resetLink = `${getSiteUrl()}/auth/reset?email=${encodeURIComponent(email)}`;
      const tpl = passwordResetEmail({ resetLink, otpCode });
      const sent = await sendEmail({
        to: email,
        templateId: "password-reset",
        ...tpl,
      });
      if (!sent) {
        console.error("[auth] password reset email failed to send via SendGrid");
      }
    } catch (err) {
      console.error("[auth] requestPasswordReset:", err);
    }

    return { ok: true as const };
  });

/**
 * Throttles reset-code guessing per email and per IP.
 *
 * Uses the KV-backed limiter because the in-memory one is per Worker isolate, which an
 * attacker spreads across trivially. Pairs with the per-code attempt counter in the store.
 */
async function assertResetOtpAttemptAllowed(email: string): Promise<void> {
  const ip = rateLimitKeyFromHeaders(getRequest()?.headers);
  const [byEmail, byIp] = await Promise.all([
    rateLimitDistributed(`pwreset-verify:email:${email}`, RATE_LIMITS.passwordResetVerify),
    rateLimitDistributed(`pwreset-verify:ip:${ip}`, RATE_LIMITS.passwordResetVerify),
  ]);
  if (byEmail.limited || byIp.limited) {
    throw new Error("Too many attempts. Request a new reset code and try again shortly.");
  }
}

/** Verifies the 6-digit code from email before showing the new-password form. */
export const verifyPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator(passwordResetOtpSchema)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const code = data.code.trim();
    await assertResetOtpAttemptAllowed(email);

    const { consumeResetAttempt, markPasswordResetVerified } =
      await import("@/lib/auth/password-reset-store");

    const attempt = await consumeResetAttempt(email, code);
    if (!attempt.ok) {
      throw new Error("Invalid or expired reset code. Request a new code.");
    }
    await markPasswordResetVerified(email);
    return { ok: true as const };
  });

/** Sets the new password after the 6-digit code has been verified. */
export const completePasswordReset = createServerFn({ method: "POST" })
  .inputValidator(passwordResetCompleteSchema)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const code = data.code.trim();
    await assertResetOtpAttemptAllowed(email);

    const { consumeResetAttempt, consumePasswordReset } =
      await import("@/lib/auth/password-reset-store");

    const attempt = await consumeResetAttempt(email, code);
    if (!attempt.ok) {
      throw new Error("Invalid or expired reset code. Request a new code.");
    }
    if (!attempt.record.verified) {
      throw new Error("Verify the 6-digit code before setting a new password.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(attempt.record.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    await consumePasswordReset(email);
    return { ok: true as const };
  });

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(9).max(30),
  role: z.enum(["tenant", "landlord", "manager", "agency"]),
  organizationName: z.string().trim().max(200).optional(),
  acceptedPolicyVersion: z.string().min(1),
  acceptedPolicyAt: z.string().datetime(),
  referralCode: z.string().trim().max(20).optional(),
});

function isDuplicateAuthUserError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already") ||
    lower.includes("registered") ||
    lower.includes("exists") ||
    lower.includes("duplicate")
  );
}

async function findAuthUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function verifyUserPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  const { normalizeAuthCredentials } = await import("@/lib/auth/credentials");
  const { email: cleanEmail, password: cleanPassword } = normalizeAuthCredentials({
    email,
    password,
  });

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });
  if (error) {
    console.debug("[auth] link-account password check failed:", error.message);
  }
  return !error;
}

async function linkPortalRoleToExistingUser(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  input: {
    userId: string;
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: PortalListerRole;
    organizationName?: string;
  },
) {
  const passwordOk = await verifyUserPassword(input.email, input.password);
  if (!passwordOk) {
    throw new Error(
      "An account with this email already exists. Sign in with your current password, or use Forgot password.",
    );
  }

  await submitPendingPortalApplicationForUser({
    userId: input.userId,
    requestedRole: input.role,
    organizationName: input.organizationName,
    phone: input.phone,
    applicantName: input.fullName.trim(),
    applicantEmail: input.email,
  });

  await supabaseAdmin.from("profiles").upsert({
    id: input.userId,
    full_name: input.fullName.trim(),
    phone: input.phone.trim(),
    updated_at: new Date().toISOString(),
  });

  const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(input.userId);
  await supabaseAdmin.auth.admin.updateUserById(input.userId, {
    user_metadata: {
      ...existingUser.user?.user_metadata,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      role: input.role,
      organization_name: input.organizationName?.trim() || undefined,
    },
  });
}

function validateSignupInput(data: z.infer<typeof signupSchema>) {
  if (ORG_REQUIRED_ROLES.has(data.role) && !data.organizationName?.trim()) {
    throw new Error(
      data.role === "landlord"
        ? "Portfolio or business name is required for landlord accounts"
        : "Organization name is required for this account type",
    );
  }
  if (!isKenyanPhone(data.phone)) {
    throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
  }
  if (data.acceptedPolicyVersion !== SIGNUP_POLICY_VERSION) {
    throw new Error("Please review and accept the latest signup terms before continuing.");
  }
}

async function validateSignupTrustSignals(
  data: z.infer<typeof signupSchema>,
  opts?: { skipPhoneCheck?: boolean },
) {
  validateSignupInput(data);
  const { assertCleanEmail, assertCleanKenyanMobile } = await import("@/lib/apilayer/verify");
  const { normalizeAuthEmail } = await import("@/lib/auth/credentials");
  const checks: Promise<unknown>[] = [assertCleanEmail(normalizeAuthEmail(data.email), "signup")];
  if (!opts?.skipPhoneCheck) {
    checks.push(assertCleanKenyanMobile(data.phone, "signup"));
  }
  await Promise.all(checks);
}

async function signupIpTrustMetadata(): Promise<Record<string, string>> {
  try {
    const request = getRequest();
    const ip = rateLimitKeyFromHeaders(request?.headers);
    if (!ip || ip === "anonymous") return {};
    const { resolveAreaHintFromIp } = await import("@/lib/apilayer/ipstack");
    const hint = await resolveAreaHintFromIp(ip);
    if (!hint.available && !hint.configured) return {};
    const meta: Record<string, string> = {};
    if (hint.countryCode) meta.signup_ip_country = hint.countryCode;
    if (hint.fraudRisk) meta.signup_ip_risk = hint.fraudRisk;
    if (hint.neighborhood || hint.county) {
      meta.preferred_area = hint.neighborhood || hint.county || "";
    }
    if (hint.countryMismatchLikely) meta.signup_ip_country_mismatch = "1";
    return meta;
  } catch (err) {
    console.warn("[auth] ipstack signup hint failed:", err);
    return {};
  }
}

type SignupMetadata = {
  full_name: string;
  phone: string;
  role: z.infer<typeof signupSchema>["role"];
  organization_name?: string;
  terms_policy_version: string;
  terms_policy_accepted_at: string;
  terms_policy_role: z.infer<typeof signupSchema>["role"];
  signup_ip_country?: string;
  signup_ip_risk?: string;
  preferred_area?: string;
  signup_ip_country_mismatch?: string;
  phone_verified?: string;
  phone_verified_via?: string;
  phone_e164?: string;
};

async function handleDuplicateSignup(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  email: string,
  data: z.infer<typeof signupSchema>,
  metadata: SignupMetadata,
) {
  const existing = await findAuthUserByEmail(email);
  if (!existing) {
    throw new Error("An account with this email already exists. Try signing in.");
  }

  if (existing.email_confirmed_at) {
    if (!isPrivilegedAccountRole(data.role as AccountRole)) {
      throw new Error("An account with this email already exists. Try signing in.");
    }

    const { normalizeAuthPassword } = await import("@/lib/auth/credentials");
    await linkPortalRoleToExistingUser(supabaseAdmin, {
      userId: existing.id,
      email,
      password: normalizeAuthPassword(data.password),
      fullName: data.fullName,
      phone: data.phone,
      role: data.role as PortalListerRole,
      organizationName: data.organizationName,
    });
    const foundingMember = await claimFoundingMemberIfEligible(supabaseAdmin, existing.id, data);
    return {
      userId: existing.id,
      recovered: false as const,
      linked: true as const,
      foundingMember,
    };
  }

  const { normalizeAuthPassword } = await import("@/lib/auth/credentials");
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password: normalizeAuthPassword(data.password),
    user_metadata: { ...existing.user_metadata, ...metadata },
  });
  if (updateError) throw updateError;

  const foundingMember = await claimFoundingMemberIfEligible(supabaseAdmin, existing.id, data);
  return { userId: existing.id, recovered: true as const, foundingMember };
}

/** Creates (or completes) an account without Supabase confirmation emails — avoids auth email rate limits. */
export const registerAccountSignup = createServerFn({ method: "POST" })
  .inputValidator(signupSchema)
  .handler(async ({ data }) => {
    checkRateLimit(`signup:${data.email.toLowerCase()}`, RATE_LIMITS.signup);
    const [, ipMeta] = await Promise.all([
      validateSignupTrustSignals(data),
      signupIpTrustMetadata(),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeAuthCredentials } = await import("@/lib/auth/credentials");
    const { email, password } = normalizeAuthCredentials({
      email: data.email,
      password: data.password,
    });
    const metadata: SignupMetadata = {
      full_name: data.fullName.trim(),
      phone: data.phone.trim(),
      role: data.role,
      organization_name: data.organizationName?.trim() || undefined,
      terms_policy_version: data.acceptedPolicyVersion,
      terms_policy_accepted_at: data.acceptedPolicyAt,
      terms_policy_role: data.role,
      ...ipMeta,
    };

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (!error && created.user) {
      const foundingMember = await claimFoundingMemberIfEligible(
        supabaseAdmin,
        created.user.id,
        data,
      );

      if (data.referralCode) {
        void trackReferralSignup(supabaseAdmin, created.user.id, data.role, data.referralCode);
      }

      return { userId: created.user.id, recovered: false as const, foundingMember };
    }

    if (error && isDuplicateAuthUserError(error.message)) {
      return handleDuplicateSignup(supabaseAdmin, email, data, metadata);
    }

    throw new Error(error?.message ?? "Could not create account");
  });

const phoneSignupRequestSchema = z.object({
  phone: z.string().trim().min(9).max(30),
});

const phoneSignupVerifySchema = z.object({
  phone: z.string().trim().min(9).max(30),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

async function assertPhoneAvailableForSignup(phone: string) {
  const { normalizeKenyanPhoneLocal, toWhatsAppDigits } = await import("@/lib/phone");
  const local = normalizeKenyanPhoneLocal(phone);
  const digits254 = toWhatsAppDigits(phone);
  if (!local || !digits254) {
    throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const variants = [local, digits254, `+${digits254}`, phone.trim()];
  const { data } = await supabaseAdmin.from("profiles").select("id").in("phone", variants).limit(1);
  if (data && data.length > 0) {
    throw new Error("An account with this phone already exists. Try signing in with email.");
  }
}

/** Send Africa’s Talking SMS OTP for phone-first signup. */
export const requestPhoneSignupOtp = createServerFn({ method: "POST" })
  .inputValidator(phoneSignupRequestSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = rateLimitKeyFromHeaders(request?.headers);
    checkRateLimit(`phonesignup:ip:${ip}`, RATE_LIMITS.phoneSignupOtp);

    if (!isKenyanPhone(data.phone)) {
      throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
    }

    const { assertCleanKenyanMobile } = await import("@/lib/apilayer/verify");
    await assertCleanKenyanMobile(data.phone, "signup");
    await assertPhoneAvailableForSignup(data.phone);

    const { generateSixDigitPhoneOtp, storePhoneSignupOtp } =
      await import("@/lib/auth/phone-signup-otp-store");
    const { toWhatsAppDigits } = await import("@/lib/phone");
    const phone254 = toWhatsAppDigits(data.phone)!;
    checkRateLimit(`phonesignup:phone:${phone254}`, RATE_LIMITS.phoneSignupOtp);

    const code = generateSixDigitPhoneOtp();
    const stored = await storePhoneSignupOtp({ phone: data.phone, code });
    if (stored.resentTooSoon) {
      const secs = Math.ceil((stored.retryAfterMs ?? 45_000) / 1000);
      throw new Error(`Wait ${secs}s before requesting another code.`);
    }

    const { phoneSignupOtpMessage, sendSmsViaAfricasTalking } =
      await import("@/lib/sms/africas-talking");
    await sendSmsViaAfricasTalking({
      to: phone254,
      message: phoneSignupOtpMessage(code),
    });

    return { ok: true as const, phone: phone254 };
  });

/** Verify the SMS OTP before continuing phone signup. */
export const verifyPhoneSignupOtp = createServerFn({ method: "POST" })
  .inputValidator(phoneSignupVerifySchema)
  .handler(async ({ data }) => {
    const {
      readPhoneSignupOtp,
      phoneOtpCodesMatch,
      markPhoneSignupOtpVerified,
      bumpPhoneSignupOtpAttempt,
    } = await import("@/lib/auth/phone-signup-otp-store");

    const record = await readPhoneSignupOtp(data.phone);
    if (!record) {
      throw new Error("Invalid or expired code. Request a new code.");
    }
    if (record.attempts >= 8) {
      throw new Error("Too many attempts. Request a new code.");
    }
    if (!phoneOtpCodesMatch(record.code, data.code)) {
      await bumpPhoneSignupOtpAttempt(data.phone);
      throw new Error("Invalid or expired code. Request a new code.");
    }
    await markPhoneSignupOtpVerified(data.phone);
    return { ok: true as const };
  });

/**
 * Finish phone-first signup after OTP verification: requires email + password.
 * Reuses the same createUser / portal application path as email signup.
 */
export const registerPhoneAccountSignup = createServerFn({ method: "POST" })
  .inputValidator(signupSchema)
  .handler(async ({ data }) => {
    const { requireVerifiedPhoneSignup, consumePhoneSignupOtp } =
      await import("@/lib/auth/phone-signup-otp-store");
    const { normalizeKenyanPhoneLocal } = await import("@/lib/phone");

    const phone254 = await requireVerifiedPhoneSignup(data.phone);
    const localPhone = normalizeKenyanPhoneLocal(data.phone) ?? data.phone.trim();

    checkRateLimit(`signup:${data.email.toLowerCase()}`, RATE_LIMITS.signup);
    // Phone already verified via SMS OTP — skip numverify re-check (common false reject).
    const [, ipMeta] = await Promise.all([
      validateSignupTrustSignals({ ...data, phone: localPhone }, { skipPhoneCheck: true }),
      signupIpTrustMetadata(),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeAuthCredentials } = await import("@/lib/auth/credentials");
    const { email, password } = normalizeAuthCredentials({
      email: data.email,
      password: data.password,
    });

    const metadata: SignupMetadata = {
      full_name: data.fullName.trim(),
      phone: localPhone,
      role: data.role,
      organization_name: data.organizationName?.trim() || undefined,
      terms_policy_version: data.acceptedPolicyVersion,
      terms_policy_accepted_at: data.acceptedPolicyAt,
      terms_policy_role: data.role,
      phone_verified: "1",
      phone_verified_via: "africas_talking_sms",
      phone_e164: phone254,
      ...ipMeta,
    };

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (!error && created.user) {
      await supabaseAdmin.from("profiles").upsert({
        id: created.user.id,
        full_name: data.fullName.trim(),
        phone: localPhone,
        updated_at: new Date().toISOString(),
      });

      const foundingMember = await claimFoundingMemberIfEligible(supabaseAdmin, created.user.id, {
        ...data,
        phone: localPhone,
      });

      if (data.referralCode) {
        void trackReferralSignup(supabaseAdmin, created.user.id, data.role, data.referralCode);
      }

      await consumePhoneSignupOtp(data.phone);
      return { userId: created.user.id, recovered: false as const, foundingMember };
    }

    if (error && isDuplicateAuthUserError(error.message)) {
      const result = await handleDuplicateSignup(
        supabaseAdmin,
        email,
        { ...data, phone: localPhone },
        metadata,
      );
      await consumePhoneSignupOtp(data.phone);
      return result;
    }

    throw new Error(error?.message ?? "Could not create account");
  });

async function claimFoundingMemberIfEligible(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  userId: string,
  data: { email: string; fullName: string; phone: string; role: string },
) {
  if (!isPromoEligibleRole(data.role)) return null;

  const role = data.role;

  const promoResult = await tryClaimFoundingMemberSlot(supabaseAdmin, userId, role, {
    fullName: data.fullName.trim(),
    phone: data.phone.trim(),
  });

  if (!promoResult.claimed || promoResult.slotNumber == null) return null;

  void cacheDelete("promo_status");

  const campaign = PROMO_LABELS[role];
  void sendFoundingMemberClaimedEmail({
    email: data.email.trim().toLowerCase(),
    name: data.fullName.trim(),
    role,
    slotNumber: promoResult.slotNumber,
  }).catch((err) => console.error("[promo] claim email failed:", err));

  return {
    slotNumber: promoResult.slotNumber,
    role,
    bonusListings: campaign.bonusListings,
  };
}

async function trackReferralSignup(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  newUserId: string,
  newUserRole: string,
  referralCode: string,
): Promise<void> {
  try {
    const db = asLooseDb(supabaseAdmin);
    const { data: referrer } = await db
      .from("profiles")
      .select("id, referral_code")
      .eq("referral_code", referralCode.toUpperCase())
      .maybeSingle();

    if (!referrer || referrer.id === newUserId) return;

    // Determine referrer's role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", referrer.id)
      .limit(1);
    const referrerRole = roles?.[0]?.role ?? "tenant";

    // Find matching reward rule
    const { data: rule } = await db
      .from("referral_reward_rules")
      .select("id")
      .eq("referrer_role", referrerRole)
      .eq("referred_role", newUserRole)
      .eq("active", 1)
      .maybeSingle();

    await db.from("referrals").insert({
      referrer_user_id: referrer.id,
      referred_user_id: newUserId,
      referrer_role_at_referral: referrerRole,
      referred_role_at_referral: newUserRole,
      rule_id: rule?.id ?? null,
      status: "pending",
    });

    await db.from("profiles").update({ referred_by_user_id: referrer.id }).eq("id", newUserId);
  } catch (err) {
    console.warn("[referral] track signup failed:", err);
  }
}
