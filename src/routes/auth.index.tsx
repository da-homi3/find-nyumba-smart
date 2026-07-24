import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type SubmitEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { withTimeout } from "@/lib/auth/with-timeout";
import {
  resolvePostLoginPath,
  type AppRole,
  type PortalId,
} from "@/lib/portal-guard";
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
  registerAccountSignup,
} from "@/lib/api/auth.functions";
import { submitPortalApplication } from "@/lib/api/portal.functions";
import { PromoBadge } from "@/components/auth/PromoBadge";
import { RoleSelector } from "@/components/auth/RoleSelector";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { BrandLogoLink } from "@/components/BrandLogo";
import { PasswordResetFlow } from "@/components/auth/PasswordResetFlow";
import { buildPageHead } from "@/lib/seo/head";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { normalizeAuthCredentials } from "@/lib/auth/credentials";

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

type PortalAppRow = { requested_role: string; status: string; created_at: string };

async function loadPortalApplications(userId: string): Promise<PortalAppRow[]> {
  const { data } = await supabase
    .from("portal_applications")
    .select("requested_role, status, created_at")
    .eq("user_id", userId);
  return (data ?? []) as PortalAppRow[];
}

async function loadActivePortal(userId: string): Promise<PortalId> {
  const { data } = await supabase
    .from("profiles")
    .select("active_portal")
    .eq("id", userId)
    .maybeSingle();
  return (data?.active_portal as PortalId) ?? "tenant";
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

function signupPrivilegedSuccessMessage(linked: boolean): string {
  if (linked) {
    return "Application submitted for your existing account — we’ll email you once approved.";
  }
  return "Application submitted — NyumbaSearch ops will review and email you when approved.";
}

async function completePrivilegedSignup(opts: {
  role: "landlord" | "manager" | "agency";
  organizationName: string;
  phone: string;
  linked: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (!opts.linked) {
    await submitPortalApplication({
      data: {
        requestedRole: opts.role,
        organizationName: opts.organizationName.trim() || undefined,
        phone: opts.phone.trim() || undefined,
      },
    });
  }
  toast.success(signupPrivilegedSuccessMessage(opts.linked));
  opts.navigate({ to: "/auth/pending" });
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
    const { email: cleanEmail, password: cleanPassword } = normalizeAuthCredentials({
      email,
      password,
    });
    const passwordError = validatePasswordPair(cleanPassword, confirmPassword.trim());
    if (passwordError) throw new Error(passwordError);

    const signupResult = await registerAccountSignup({
      data: {
        email: cleanEmail,
        password: cleanPassword,
        fullName,
        phone: phone.trim(),
        role,
        organizationName: organizationName.trim() || undefined,
      },
    });

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });
    if (signInError) throw signInError;

    if (signupResult.foundingMember) {
      toast.success(
        `Founding Member #${signupResult.foundingMember.slotNumber} — +${signupResult.foundingMember.bonusListings} bonus listings after your first paid month`,
      );
    }

    if (isPrivilegedAccountRole(role)) {
      await completePrivilegedSignup({
        role: role as "landlord" | "manager" | "agency",
        organizationName,
        phone,
        linked: "linked" in signupResult && Boolean(signupResult.linked),
        navigate,
      });
      return;
    }

    markSignupTourPending("tenant");
    toast.success("Welcome to NyumbaSearch!");
    void ensureTenantAccount().catch((err) => {
      console.warn("[auth] ensureTenantAccount after signup:", err);
    });
    globalThis.location.href = "/tenant";
  }

  async function handleSignin() {
    const { email: cleanEmail, password: cleanPassword } = normalizeAuthCredentials({
      email,
      password,
    });
    if (!cleanEmail || !cleanPassword) {
      throw new Error("Enter your email and password.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Sign in failed");

    // Client queries with timeouts — avoid hanging on server-fn / getSession contention.
    const roles = await withTimeout(resolveRoles(data.user), 4000, [] as string[]);
    const apps = await withTimeout(
      loadPortalApplications(data.user.id),
      4000,
      [] as PortalAppRow[],
    );
    const hasPendingOnly =
      apps.some((a) => a.status === "pending") &&
      !roles.some((r) => DASHBOARD_APPROVAL_ROLES.has(r));

    if (hasPendingOnly) {
      navigate({ to: "/auth/pending" });
      return;
    }

    const activePortal = await withTimeout(
      loadActivePortal(data.user.id),
      3000,
      "tenant" as PortalId,
    );

    void ensureTenantAccount().catch((err) => {
      console.warn("[auth] ensureTenantAccount after signin:", err);
    });

    globalThis.location.href = resolvePostLoginPath(
      roles as AppRole[],
      activePortal,
      redirect,
      apps,
    );
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
    const hardStop = globalThis.setTimeout(() => {
      setLoading(false);
      toast.error("Sign-in is taking too long. Check your connection and try again.");
    }, 25_000);
    submitForm()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => {
        globalThis.clearTimeout(hardStop);
        setLoading(false);
      });
  }

  const submitLabel = authSubmitLabel(loading, mode === "reset" ? "signin" : mode);
  const showGoogle = mode === "signin" || role === "tenant";

  if (mode === "reset") {
    return (
      <AuthPageShell>
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
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <h1 className="mt-6 font-display text-3xl font-semibold">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Sign in to save homes and contact verified property owners."
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

      {showGoogle && (
        <div className="mt-4 space-y-3">
          <GoogleAuthButton
            nextPath={redirect?.startsWith("/") ? redirect : "/tenant"}
            label={mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
            disabled={loading}
          />
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span>or email</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <SignupProfileFields
            fullName={fullName}
            phone={phone}
            organizationName={organizationName}
            role={role}
            onFullNameChange={setFullName}
            onPhoneChange={setPhone}
            onOrganizationNameChange={setOrganizationName}
            onRoleChange={setRole}
          />
        )}

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmail((v) => v.trim())}
            required
            className={inputCls}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signup" ? 8 : 1}
            className={inputCls}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
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
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
    </AuthPageShell>
  );
}

function AuthPageShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <BrandLogoLink className="mt-6" logoClassName="h-10" />
        {children}
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

function SignupProfileFields({
  fullName,
  phone,
  organizationName,
  role,
  onFullNameChange,
  onPhoneChange,
  onOrganizationNameChange,
  onRoleChange,
}: Readonly<{
  fullName: string;
  phone: string;
  organizationName: string;
  role: AccountRole;
  onFullNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onOrganizationNameChange: (value: string) => void;
  onRoleChange: (value: AccountRole) => void;
}>) {
  return (
    <>
      <Field label="Full name">
        <input
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <Field label="Phone (M-Pesa number)">
        <input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="07XX XXX XXX"
          required
          className={inputCls}
        />
      </Field>

      <Field label="Account type">
        <RoleSelector value={role} onSelect={onRoleChange} />
        <PromoBadge role={role} />
      </Field>

      {ORG_REQUIRED_ROLES.has(role) && (
        <Field label={organizationFieldLabel(role)}>
          <input
            value={organizationName}
            onChange={(e) => onOrganizationNameChange(e.target.value)}
            required
            placeholder={organizationFieldPlaceholder(role)}
            className={inputCls}
          />
        </Field>
      )}

      {isPrivilegedAccountRole(role) && (
        <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Landlord, property manager, and agency accounts require NyumbaSearch admin approval
          before dashboard access. After your first paid month, you get one bonus month free.
        </p>
      )}
    </>
  );
}
