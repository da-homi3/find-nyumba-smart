import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { ORG_REQUIRED_ROLES } from "@/lib/account-roles";
import { checkRateLimit, rateLimitKeyFromHeaders, RATE_LIMITS } from "@/lib/api/rate-limit";
import { passwordResetEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site";
import { isKenyanPhone } from "@/lib/phone";

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

/** Creates (or completes) an account without Supabase confirmation emails — avoids auth email rate limits. */
export const registerAccountSignup = createServerFn({ method: "POST" })
  .inputValidator(signupSchema)
  .handler(async ({ data }) => {
    checkRateLimit(`signup:${data.email.toLowerCase()}`, RATE_LIMITS.signup);

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const metadata = {
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
      return { userId: created.user.id, recovered: false as const };
    }

    if (error && isDuplicateAuthUserError(error.message)) {
      const existing = await findAuthUserByEmail(email);
      if (!existing) {
        throw new Error("An account with this email already exists. Try signing in.");
      }
      if (existing.email_confirmed_at) {
        throw new Error("An account with this email already exists. Try signing in.");
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        password: data.password,
        user_metadata: { ...existing.user_metadata, ...metadata },
      });
      if (updateError) throw updateError;

      return { userId: existing.id, recovered: true as const };
    }

    throw new Error(error?.message ?? "Could not create account");
  });
