import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { ORG_REQUIRED_ROLES, isPrivilegedAccountRole, type AccountRole } from "@/lib/account-roles";
import { submitPendingPortalApplicationForUser } from "@/lib/api/portal.functions";
import type { PortalListerRole } from "@/lib/payments/portal-trial";
import { checkRateLimit, rateLimitKeyFromHeaders, RATE_LIMITS } from "@/lib/api/rate-limit";
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

/** Verifies the 6-digit code from email before showing the new-password form. */
export const verifyPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator(passwordResetOtpSchema)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const code = data.code.trim();
    const { readPasswordReset, codesMatch, markPasswordResetVerified } =
      await import("@/lib/auth/password-reset-store");

    const record = await readPasswordReset(email);
    if (!record || !codesMatch(record.code, code)) {
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
    const { readPasswordReset, codesMatch, consumePasswordReset } =
      await import("@/lib/auth/password-reset-store");

    const record = await readPasswordReset(email);
    if (!record || !codesMatch(record.code, code)) {
      throw new Error("Invalid or expired reset code. Request a new code.");
    }
    if (!record.verified) {
      throw new Error("Verify the 6-digit code before setting a new password.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(record.userId, {
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

  while (page <= 10) {
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

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
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
}

type SignupMetadata = {
  full_name: string;
  phone: string;
  role: z.infer<typeof signupSchema>["role"];
  organization_name?: string;
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

    await linkPortalRoleToExistingUser(supabaseAdmin, {
      userId: existing.id,
      email,
      password: data.password,
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

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password: data.password,
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
    validateSignupInput(data);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const metadata: SignupMetadata = {
      full_name: data.fullName.trim(),
      phone: data.phone.trim(),
      role: data.role,
      organization_name: data.organizationName?.trim() || undefined,
    };

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (!error && created.user) {
      const foundingMember = await claimFoundingMemberIfEligible(
        supabaseAdmin,
        created.user.id,
        data,
      );
      return { userId: created.user.id, recovered: false as const, foundingMember };
    }

    if (error && isDuplicateAuthUserError(error.message)) {
      return handleDuplicateSignup(supabaseAdmin, email, data, metadata);
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
