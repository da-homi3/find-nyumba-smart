import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type SubmitEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { resolvePostLoginPath, type AppRole, type PortalId } from "@/lib/portal-guard";
import {
  type AccountRole,
  DASHBOARD_APPROVAL_ROLES,
  isPrivilegedAccountRole,
  ORG_REQUIRED_ROLES,
  organizationFieldLabel,
  organizationFieldPlaceholder,
} from "@/lib/account-roles";
import { isKenyanPhone } from "@/lib/phone";
import { validatePasswordPair } from "@/lib/validate-password";
import { authSubmitLabel, errorMessage } from "@/lib/utils";
import {
  getMyProfilePortal,
  listMyPortalApplications,
  submitPortalApplication,
} from "@/lib/api/portal.functions";
import { registerAccountSignup } from "@/lib/api/auth.functions";
import { PromoBadge } from "@/components/auth/PromoBadge";
import { BrandLogoLink } from "@/components/BrandLogo";
import { PasswordResetFlow } from "@/components/auth/PasswordResetFlow";
import { buildPageHead } from "@/lib/seo/head";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
  /** Client-only UX hint — never used for authorization; role is chosen in the signup form. */
  signupFor: z.enum(["tenant", "landlord", "manager", "agency"]).optional(),
  mode: z.enum(["signin", "signup", "reset"]).optional(),
});

export const Route = createFileRoute("/auth/")({
  validateSearch: authSearchSchema,
  head: () =>
    buildPageHead({
      title: "Sign in — NyumbaSearch",
      description: "Sign in to save homes and contact landlords directly on NyumbaSearch.",
      path: "/auth",
      noIndex: true,
    }),
  component: TenantAuth,
});

async function resolveRoles(user: User): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role as string);
}

function signupSubtitle(role: AccountRole): string {
  if (role === "landlord") {
    return "Apply to list properties on NyumbaSearch — ops will review before dashboard access.";
  }
  if (role === "manager") {
    return "Apply to manage properties on NyumbaSearch — ops will review your account.";
  }
  if (role === "agency") {
    return "Apply as a real estate agency — ops will review before dashboard access.";
  }
  return "Join thousands finding verified homes in Nairobi.";
}

function TenantAuth() {
  const { redirect, signupFor, mode: modeParam } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(
    modeParam === "reset" ? "reset" : (modeParam ?? "signin"),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [role, setRole] = useState<AccountRole>(signupFor ?? "tenant");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modeParam === "reset") setMode("reset");
    else if (modeParam) setMode(modeParam);
    if (signupFor && modeParam === "signup") setRole(signupFor);
  }, [modeParam, signupFor]);

  async function handleSignup() {
    if (ORG_REQUIRED_ROLES.has(role) && !organizationName.trim()) {
      throw new Error("Organization name is required for this account type");
    }
    if (!isKenyanPhone(phone)) {
      throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
    }
    const passwordError = validatePasswordPair(password, confirmPassword);
    if (passwordError) throw new Error(passwordError);

    const signupResult = await registerAccountSignup({
      data: {
        email,
        password,
        fullName,
        phone: phone.trim(),
        role,
        organizationName: organizationName.trim() || undefined,
      },
    });

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    if (signupResult.foundingMember) {
      toast.success(
        `Founding Member #${signupResult.foundingMember.slotNumber} — +${signupResult.foundingMember.bonusListings} bonus listings after your first paid month`,
      );
    }

    if (isPrivilegedAccountRole(role)) {
      const privilegedRole = role as "landlord" | "manager" | "agency";
      const portalPayload = {
        requestedRole: privilegedRole,
        organizationName: organizationName.trim() || undefined,
        phone: phone.trim() || undefined,
      };

      await submitPortalApplication({ data: portalPayload });

      toast.success("Application submitted — we'll email you when approved.");
      navigate({ to: "/auth/pending" });
      return;
    }

    toast.success("Welcome to NyumbaSearch!");
    globalThis.location.href = "/tenant";
  }

  async function handleSignin() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Sign in failed");

    const roles = await resolveRoles(data.user);
    const apps = await listMyPortalApplications();
    const hasPendingOnly =
      apps.some((a) => a.status === "pending") &&
      !roles.some((r) => DASHBOARD_APPROVAL_ROLES.has(r));

    if (hasPendingOnly) {
      navigate({ to: "/auth/pending" });
      return;
    }

    let activePortal: PortalId = "tenant";
    try {
      const profile = await getMyProfilePortal();
      activePortal = (profile?.active_portal as PortalId) ?? "tenant";
    } catch (err) {
      console.debug("[auth] Profile portal not ready after login:", err);
    }

    globalThis.location.href = resolvePostLoginPath(roles as AppRole[], activePortal, redirect);
  }

  async function submitForm() {
    if (mode === "signup") {
      await handleSignup();
    } else {
      await handleSignin();
    }
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    submitForm()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }

  const submitLabel = authSubmitLabel(loading, mode === "reset" ? "signin" : mode);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <BrandLogoLink className="mt-6" logoClassName="h-10" />

        {mode === "reset" ? (
          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
            <PasswordResetFlow
              initialEmail={email}
              onCancel={() => {
                setMode("signin");
                void navigate({
                  to: "/auth",
                  search: { redirect, mode: "signin" },
                  replace: true,
                });
              }}
            />
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-3xl font-semibold">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to save homes and contact landlords — no agents."
                : signupSubtitle(role)}
            </p>

            <div className="mt-6 flex rounded-xl border bg-secondary p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    mode === m ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  <Field label="Full name">
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Phone (M-Pesa number)">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      required
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Account type">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as AccountRole)}
                      className={inputCls}
                    >
                      <option value="tenant">Tenant</option>
                      <option value="landlord">Landlord</option>
                      <option value="manager">Property manager</option>
                      <option value="agency">Real estate agency</option>
                    </select>
                    <PromoBadge role={role} />
                  </Field>

                  {ORG_REQUIRED_ROLES.has(role) && (
                    <Field label={organizationFieldLabel(role)}>
                      <input
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        required
                        placeholder={organizationFieldPlaceholder(role)}
                        className={inputCls}
                      />
                    </Field>
                  )}

                  {isPrivilegedAccountRole(role) && (
                    <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                      Landlord, property manager, and agency accounts are reviewed by NyumbaSearch
                      operations before dashboard access is granted.
                    </p>
                  )}
                </>
              )}

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "signup" ? 8 : 6}
                  className={inputCls}
                />
              </Field>

              {mode === "signup" && (
                <Field label="Confirm password">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className={inputCls}
                  />
                </Field>
              )}

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    void navigate({
                      to: "/auth",
                      search: { redirect, mode: "reset" },
                      replace: true,
                    });
                  }}
                  className="block w-full text-right text-xs font-semibold text-primary"
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
              >
                {submitLabel}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/settings" className="font-semibold text-foreground">
                Settings & portals
              </Link>
              {" · "}
              <Link to="/caretaker" className="font-semibold text-foreground">
                Caretaker PIN sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
