import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type SubmitEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { withTimeout, withTimeoutOrThrow } from "@/lib/auth/with-timeout";
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
import { registerAccountSignup } from "@/lib/api/auth.functions";
import { submitPortalApplication } from "@/lib/api/portal.functions";
import { PromoBadge } from "@/components/auth/PromoBadge";
import { RoleSelector } from "@/components/auth/RoleSelector";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { SignupPolicyDialog } from "@/components/auth/SignupPolicyDialog";
import { BrandLogoLink } from "@/components/BrandLogo";
import { PasswordResetFlow } from "@/components/auth/PasswordResetFlow";
import { PhoneSignupFlow } from "@/components/auth/PhoneSignupFlow";
import { SIGNUP_POLICY_VERSION } from "@/lib/auth/signup-policy";
import { buildPageHead } from "@/lib/seo/head";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { normalizeAuthCredentials } from "@/lib/auth/credentials";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
  /** Client-only UX hint — never used for authorization; role is chosen in the signup form. */
  signupFor: z.enum(["tenant", "landlord", "manager", "agency"]).optional(),
  mode: z.enum(["signin", "signup", "reset"]).optional(),
  ref: z.string().optional(),
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

function kickEnsureTenantAccount(context: string) {
  ensureTenantAccount().catch((err) => {
    console.warn(`[auth] ensureTenantAccount ${context}:`, err);
  });
}

function runAuthAction(
  action: () => Promise<void>,
  opts: {
    hardStopMs: number;
    timeoutMessage: string;
    setLoading: (v: boolean) => void;
  },
) {
  opts.setLoading(true);
  const hardStop = globalThis.setTimeout(() => {
    opts.setLoading(false);
    toast.error(opts.timeoutMessage);
  }, opts.hardStopMs);
  action()
    .catch((err) => toast.error(errorMessage(err)))
    .finally(() => {
      globalThis.clearTimeout(hardStop);
      opts.setLoading(false);
    });
}

async function handleEmailSignup(opts: {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  role: AccountRole;
  organizationName: string;
  policyAcceptedAt: string | null;
  referralCode?: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (ORG_REQUIRED_ROLES.has(opts.role) && !opts.organizationName.trim()) {
    throw new Error("Organization name is required for this account type");
  }
  if (!isKenyanPhone(opts.phone)) {
    throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
  }
  const { email: cleanEmail, password: cleanPassword } = normalizeAuthCredentials({
    email: opts.email,
    password: opts.password,
  });
  const passwordError = validatePasswordPair(cleanPassword, opts.confirmPassword.trim());
  if (passwordError) throw new Error(passwordError);

  const signupResult = await registerAccountSignup({
    data: {
      email: cleanEmail,
      password: cleanPassword,
      fullName: opts.fullName,
      phone: opts.phone.trim(),
      role: opts.role,
      organizationName: opts.organizationName.trim() || undefined,
      acceptedPolicyVersion: SIGNUP_POLICY_VERSION,
      acceptedPolicyAt: opts.policyAcceptedAt ?? new Date().toISOString(),
      referralCode: opts.referralCode?.trim() || undefined,
    },
  });

  const { error: signInError } = await withTimeoutOrThrow(
    supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    }),
    30_000,
    "Sign-in timed out. Check your connection and try again.",
  );
  if (signInError) throw signInError;

  if (signupResult.foundingMember) {
    toast.success(
      `Founding Member #${signupResult.foundingMember.slotNumber} — +${signupResult.foundingMember.bonusListings} bonus listings after your first paid month`,
    );
  }

  if (isPrivilegedAccountRole(opts.role)) {
    try {
      await ensureTenantAccount();
    } catch (err) {
      console.warn("[auth] ensureTenantAccount after privileged signup:", err);
    }
    await completePrivilegedSignup({
      role: opts.role as "landlord" | "manager" | "agency",
      organizationName: opts.organizationName,
      phone: opts.phone,
      linked: "linked" in signupResult && Boolean(signupResult.linked),
      navigate: opts.navigate,
    });
    return;
  }

  markSignupTourPending("tenant");
  toast.success("Welcome to NyumbaSearch!");
  kickEnsureTenantAccount("after signup");
  globalThis.location.href = "/tenant";
}

async function handleEmailSignin(opts: {
  email: string;
  password: string;
  redirect?: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { email: cleanEmail, password: cleanPassword } = normalizeAuthCredentials({
    email: opts.email,
    password: opts.password,
  });
  if (!cleanEmail || !cleanPassword) {
    throw new Error("Enter your email and password.");
  }

  const { data, error } = await withTimeoutOrThrow(
    supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    }),
    30_000,
    "Sign-in timed out. Check your connection and try again.",
  );
  if (error) throw error;
  if (!data.user) throw new Error("Sign in failed");

  // Parallel role/app reads — avoid stacking timeouts after a successful auth.
  const [roles, apps] = await Promise.all([
    withTimeout(resolveRoles(data.user), 6_000, [] as string[]),
    withTimeout(loadPortalApplications(data.user.id), 6_000, [] as PortalAppRow[]),
  ]);

  kickEnsureTenantAccount("after signin");

  const hasApprovedDashboardRole = roles.some((r) => DASHBOARD_APPROVAL_ROLES.has(r));
  const hasTenantRole = roles.includes("tenant");
  const hasPendingListerApp = apps.some((a) => a.status === "pending");
  // Only hold brand-new lister applicants (no tenant/dashboard role yet).
  // Tenants who applied for landlord/manager/agency must still sign in normally.
  if (hasPendingListerApp && !hasApprovedDashboardRole && !hasTenantRole) {
    opts.navigate({ to: "/auth/pending" });
    return;
  }

  const activePortal = await withTimeout(
    loadActivePortal(data.user.id),
    3_000,
    "tenant" as PortalId,
  );

  globalThis.location.href = resolvePostLoginPath(
    roles as AppRole[],
    activePortal,
    opts.redirect,
    apps,
  );
}

type AuthMode = "signin" | "signup" | "reset";
type SignupChannel = "email" | "phone";

function syncAuthModeFromSearch(
  modeParam: AuthMode | undefined,
  setMode: (mode: AuthMode) => void,
) {
  if (modeParam === "reset") {
    setMode("reset");
    return;
  }
  if (modeParam) setMode(modeParam);
}

function authHardStopMessage(isSignup: boolean): string {
  if (isSignup) {
    return "Sign-up is taking too long. Check your connection and try again.";
  }
  return "Sign-in is taking too long. Check your connection and try again.";
}

function TenantAuth() {
  const { redirect, signupFor, mode: modeParam, ref: refCode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(
    modeParam === "reset" ? "reset" : (modeParam ?? "signin"),
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>(signupFor ?? "tenant");

  useEffect(() => {
    syncAuthModeFromSearch(modeParam, setMode);
    if (signupFor && modeParam === "signup") setRole(signupFor);
  }, [modeParam, signupFor]);

  if (mode === "reset") {
    return (
      <AuthPageShell>
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
          <PasswordResetFlow
            initialEmail={email}
            onCancel={() => {
              setMode("signin");
              navigate({
                to: "/auth",
                search: { redirect, mode: "signin" },
                replace: true,
              }).catch(() => undefined);
            }}
          />
        </div>
      </AuthPageShell>
    );
  }

  return (
    <TenantAuthForm
      mode={mode}
      setMode={setMode}
      email={email}
      setEmail={setEmail}
      role={role}
      setRole={setRole}
      redirect={redirect}
      refCode={refCode}
      navigate={navigate}
    />
  );
}

function AuthModeToggle({
  mode,
  onSelect,
}: Readonly<{
  mode: "signin" | "signup";
  onSelect: (mode: "signin" | "signup") => void;
}>) {
  return (
    <div className="mt-6 flex rounded-xl border bg-secondary p-1">
      {(["signin", "signup"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onSelect(m)}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
            mode === m ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          {m === "signin" ? "Sign in" : "Sign up"}
        </button>
      ))}
    </div>
  );
}

function SignupChannelToggle({
  channel,
  onSelect,
}: Readonly<{
  channel: SignupChannel;
  onSelect: (channel: SignupChannel) => void;
}>) {
  return (
    <div className="mt-4 flex rounded-xl border bg-secondary p-1">
      {(["email", "phone"] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
            channel === c ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          {c === "email" ? "Email" : "Phone"}
        </button>
      ))}
    </div>
  );
}

function TenantAuthForm({
  mode,
  setMode,
  email,
  setEmail,
  role,
  setRole,
  redirect,
  refCode,
  navigate,
}: Readonly<{
  mode: "signin" | "signup";
  setMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  role: AccountRole;
  setRole: (value: AccountRole) => void;
  redirect?: string;
  refCode?: string;
  navigate: ReturnType<typeof useNavigate>;
}>) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyAcceptedAt, setPolicyAcceptedAt] = useState<string | null>(null);
  const [policyAcceptedRole, setPolicyAcceptedRole] = useState<AccountRole | null>(null);
  const [pendingAction, setPendingAction] = useState<"email" | "google" | null>(null);
  const [googleStartSignal, setGoogleStartSignal] = useState(0);
  const [signupChannel, setSignupChannel] = useState<SignupChannel>("email");

  const signupOpts = {
    email,
    password,
    confirmPassword,
    fullName,
    phone,
    role,
    organizationName,
    policyAcceptedAt,
    referralCode: refCode,
    navigate,
  };

  function startEmailAuth() {
    if (mode === "signup") {
      runAuthAction(() => handleEmailSignup(signupOpts), {
        hardStopMs: 60_000,
        timeoutMessage: authHardStopMessage(true),
        setLoading,
      });
      return;
    }
    runAuthAction(() => handleEmailSignin({ email, password, redirect, navigate }), {
      hardStopMs: 60_000,
      timeoutMessage: authHardStopMessage(false),
      setLoading,
    });
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "signup" && (policyAcceptedRole !== role || !policyAcceptedAt)) {
      setPendingAction("email");
      setPolicyOpen(true);
      return;
    }
    startEmailAuth();
  }

  function closePolicy() {
    if (loading) return;
    setPolicyOpen(false);
    setPendingAction(null);
  }

  function acceptPolicy() {
    const acceptedAt = new Date().toISOString();
    setPolicyAcceptedAt(acceptedAt);
    setPolicyAcceptedRole(role);
    setPolicyOpen(false);

    if (pendingAction === "google") {
      setPendingAction(null);
      setGoogleStartSignal((value) => value + 1);
      return;
    }

    if (pendingAction === "email") {
      setPendingAction(null);
      runAuthAction(
        () =>
          handleEmailSignup({
            ...signupOpts,
            policyAcceptedAt: acceptedAt,
          }),
        {
          hardStopMs: 60_000,
          timeoutMessage: authHardStopMessage(true),
          setLoading,
        },
      );
    }
  }

  const showPhoneSignup = mode === "signup" && signupChannel === "phone";
  const showGoogle = mode === "signin" || role === "tenant";

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

      <AuthModeToggle
        mode={mode}
        onSelect={(m) => {
          setMode(m);
          if (m === "signin") setSignupChannel("email");
        }}
      />

      {mode === "signup" ? (
        <SignupChannelToggle channel={signupChannel} onSelect={setSignupChannel} />
      ) : null}

      {showPhoneSignup ? (
        <PhoneSignupFlow
          referralCode={refCode}
          initialRole={role}
          onCancel={() => setSignupChannel("email")}
        />
      ) : (
        <EmailAuthPanel
          mode={mode}
          loading={loading}
          showGoogle={showGoogle}
          submitLabel={authSubmitLabel(loading, mode)}
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          fullName={fullName}
          phone={phone}
          organizationName={organizationName}
          role={role}
          redirect={redirect}
          googleStartSignal={googleStartSignal}
          policyAcceptedAt={policyAcceptedAt}
          policyAcceptedRole={policyAcceptedRole}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onFullNameChange={setFullName}
          onPhoneChange={setPhone}
          onOrganizationNameChange={setOrganizationName}
          onRoleChange={setRole}
          onForgotPassword={() => {
            setMode("reset");
            navigate({
              to: "/auth",
              search: { redirect, mode: "reset" },
              replace: true,
            }).catch(() => undefined);
          }}
          onGooglePolicyNeeded={() => {
            setPendingAction("google");
            setPolicyOpen(true);
          }}
          onSubmit={onSubmit}
        />
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/settings" className="font-semibold text-foreground">
          Settings & portals
        </Link>
        {" · "}
        <Link to="/caretaker" className="font-semibold text-foreground">
          Caretaker PIN sign in
        </Link>
      </p>
      <SignupPolicyDialog
        open={policyOpen}
        role={role}
        busy={loading}
        onClose={closePolicy}
        onAccept={acceptPolicy}
      />
    </AuthPageShell>
  );
}

function EmailAuthPanel({
  mode,
  loading,
  showGoogle,
  submitLabel,
  email,
  password,
  confirmPassword,
  fullName,
  phone,
  organizationName,
  role,
  redirect,
  googleStartSignal,
  policyAcceptedAt,
  policyAcceptedRole,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onFullNameChange,
  onPhoneChange,
  onOrganizationNameChange,
  onRoleChange,
  onForgotPassword,
  onGooglePolicyNeeded,
  onSubmit,
}: Readonly<{
  mode: "signin" | "signup";
  loading: boolean;
  showGoogle: boolean;
  submitLabel: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  organizationName: string;
  role: AccountRole;
  redirect?: string;
  googleStartSignal: number;
  policyAcceptedAt: string | null;
  policyAcceptedRole: AccountRole | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onOrganizationNameChange: (value: string) => void;
  onRoleChange: (value: AccountRole) => void;
  onForgotPassword: () => void;
  onGooglePolicyNeeded: () => void;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
}>) {
  const googlePolicyOk = policyAcceptedRole === "tenant" && Boolean(policyAcceptedAt);
  const googlePolicyAcceptance =
    mode === "signup" && googlePolicyOk && policyAcceptedAt
      ? {
          role: "tenant" as const,
          version: SIGNUP_POLICY_VERSION,
          acceptedAt: policyAcceptedAt,
        }
      : undefined;

  return (
    <>
      {showGoogle ? (
        <div className="mt-4 space-y-3">
          <GoogleAuthButton
            nextPath={redirect?.startsWith("/") ? redirect : "/tenant"}
            label={mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
            disabled={loading}
            onBeforeStart={() => {
              if (mode !== "signup") return true;
              if (googlePolicyOk) return true;
              onGooglePolicyNeeded();
              return false;
            }}
            startSignal={googleStartSignal}
            policyAcceptance={googlePolicyAcceptance}
          />
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span>or email</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === "signup" ? (
          <SignupProfileFields
            fullName={fullName}
            phone={phone}
            organizationName={organizationName}
            role={role}
            onFullNameChange={onFullNameChange}
            onPhoneChange={onPhoneChange}
            onOrganizationNameChange={onOrganizationNameChange}
            onRoleChange={onRoleChange}
          />
        ) : null}

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={() => onEmailChange(email.trim())}
            required
            className={inputCls}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            enterKeyHint="next"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            minLength={mode === "signup" ? 8 : 1}
            className={inputCls}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={mode === "signup" ? "next" : "go"}
          />
        </Field>

        {mode === "signup" ? (
          <Field label="Confirm password">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              required
              minLength={8}
              className={inputCls}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
            />
          </Field>
        ) : null}

        {mode === "signin" ? (
          <button
            type="button"
            onClick={onForgotPassword}
            className="block w-full text-right text-xs font-semibold text-primary"
          >
            Forgot password?
          </button>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </form>
    </>
  );
}

function AuthPageShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-md px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-10">
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
  "w-full min-h-11 rounded-xl border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";

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
          autoComplete="name"
          enterKeyHint="next"
        />
      </Field>

      <Field label="Phone (M-Pesa number)">
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="07XX XXX XXX"
          required
          className={inputCls}
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="next"
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
          Landlord, property manager, and agency accounts require NyumbaSearch admin approval before
          dashboard access. After your first paid month, you get one bonus month free.
        </p>
      )}
    </>
  );
}
