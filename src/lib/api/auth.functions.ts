import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ORG_REQUIRED_ROLES } from "@/lib/account-roles";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { isKenyanPhone } from "@/lib/phone";

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
    checkRateLimit(`signup:${data.email.toLowerCase()}`);

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
