import { useState, type ReactNode, type SubmitEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OtpInput } from "@/components/auth/OtpInput";
import { PromoBadge } from "@/components/auth/PromoBadge";
import { RoleSelector } from "@/components/auth/RoleSelector";
import { SignupPolicyDialog } from "@/components/auth/SignupPolicyDialog";
import {
  type AccountRole,
  isPrivilegedAccountRole,
  ORG_REQUIRED_ROLES,
  organizationFieldLabel,
  organizationFieldPlaceholder,
} from "@/lib/account-roles";
import { normalizeAuthCredentials } from "@/lib/auth/credentials";
import { SIGNUP_POLICY_VERSION } from "@/lib/auth/signup-policy";
import { withTimeoutOrThrow } from "@/lib/auth/with-timeout";
import {
  registerPhoneAccountSignup,
  requestPhoneSignupOtp,
  verifyPhoneSignupOtp,
} from "@/lib/api/auth.functions";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { submitPortalApplication } from "@/lib/api/portal.functions";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { formatKenyanPhoneHint, isKenyanPhone } from "@/lib/phone";
import { validatePasswordPair } from "@/lib/validate-password";
import { errorMessage } from "@/lib/utils";

type Step = "phone" | "otp" | "details" | "email";

const inputCls =
  "w-full min-h-11 rounded-xl border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";

const STEP_SUBMIT_LABEL: Record<Step, string> = {
  phone: "Send SMS code",
  otp: "Verify code",
  details: "Continue",
  email: "Create account",
};

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function phoneSignupSubmitLabel(loading: boolean, step: Step): string {
  if (loading) return "Please wait…";
  return STEP_SUBMIT_LABEL[step];
}

function kickEnsureTenantAccount(context: string) {
  ensureTenantAccount().catch((err) => {
    console.warn(`[auth] ensureTenantAccount ${context}:`, err);
  });
}

async function sendPhoneSignupOtp(phone: string) {
  if (!isKenyanPhone(phone)) {
    throw new Error(`Enter a valid Kenyan mobile (${formatKenyanPhoneHint()})`);
  }
  await requestPhoneSignupOtp({ data: { phone: phone.trim() } });
  toast.success("Code sent by SMS");
}

async function confirmPhoneSignupOtp(phone: string, code: string) {
  if (!/^\d{6}$/.test(code.trim())) {
    throw new Error("Enter the 6-digit code from SMS");
  }
  await verifyPhoneSignupOtp({ data: { phone: phone.trim(), code: code.trim() } });
  toast.success("Phone verified");
}

async function finishPrivilegedPhoneSignup(opts: {
  role: "landlord" | "manager" | "agency";
  organizationName: string;
  phone: string;
  linked: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  try {
    await ensureTenantAccount();
  } catch (err) {
    console.warn("[auth] ensureTenantAccount after phone signup:", err);
  }
  if (!opts.linked) {
    await submitPortalApplication({
      data: {
        requestedRole: opts.role,
        organizationName: opts.organizationName.trim() || undefined,
        phone: opts.phone.trim() || undefined,
      },
    });
  }
  toast.success(
    opts.linked
      ? "Application submitted for your existing account — we’ll email you once approved."
      : "Application submitted — NyumbaSearch ops will review and email you when approved.",
  );
  opts.navigate({ to: "/auth/pending" });
}

async function finishPhoneSignup(opts: {
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
  const { email: cleanEmail, password: cleanPassword } = normalizeAuthCredentials({
    email: opts.email,
    password: opts.password,
  });
  if (!cleanEmail) throw new Error("Email is required to finish signup");
  const passwordError = validatePasswordPair(cleanPassword, opts.confirmPassword.trim());
  if (passwordError) throw new Error(passwordError);

  const signupResult = await registerPhoneAccountSignup({
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
    await finishPrivilegedPhoneSignup({
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
  kickEnsureTenantAccount("after phone signup");
  globalThis.location.href = "/tenant";
}

export function PhoneSignupFlow({
  referralCode,
  initialRole = "tenant",
  onCancel,
}: Readonly<{
  referralCode?: string;
  initialRole?: AccountRole;
  onCancel: () => void;
}>) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AccountRole>(initialRole);
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyAcceptedAt, setPolicyAcceptedAt] = useState<string | null>(null);
  const [policyAcceptedRole, setPolicyAcceptedRole] = useState<AccountRole | null>(null);

  function run(action: () => Promise<void>) {
    setLoading(true);
    const hardStop = globalThis.setTimeout(() => {
      setLoading(false);
      toast.error("Taking too long. Check your connection and try again.");
    }, 60_000);
    action()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => {
        globalThis.clearTimeout(hardStop);
        setLoading(false);
      });
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === "phone") {
      run(async () => {
        await sendPhoneSignupOtp(phone);
        setStep("otp");
        setOtp("");
      });
      return;
    }
    if (step === "otp") {
      run(async () => {
        await confirmPhoneSignupOtp(phone, otp);
        setStep("details");
      });
      return;
    }
    if (step === "details") {
      const passwordError = validatePasswordPair(password, confirmPassword.trim());
      if (passwordError) {
        toast.error(passwordError);
        return;
      }
      if (!fullName.trim()) {
        toast.error("Enter your full name");
        return;
      }
      setStep("email");
      return;
    }
    if (policyAcceptedRole !== role || !policyAcceptedAt) {
      setPolicyOpen(true);
      return;
    }
    run(() =>
      finishPhoneSignup({
        email,
        password,
        confirmPassword,
        fullName,
        phone,
        role,
        organizationName,
        policyAcceptedAt,
        referralCode,
        navigate,
      }),
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Sign up with phone</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Use email instead
        </button>
      </div>

      <ol className="flex gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {(["phone", "otp", "details", "email"] as const).map((s) => (
          <li
            key={s}
            className={`rounded-md px-2 py-1 ${step === s ? "bg-primary/15 font-semibold text-primary" : "bg-muted"}`}
          >
            {s}
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} className="space-y-4">
        {step === "phone" ? (
          <Field label="Phone number">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={formatKenyanPhoneHint()}
              required
              inputMode="tel"
              autoComplete="tel"
              className={inputCls}
            />
          </Field>
        ) : null}

        {step === "otp" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-semibold">{phone}</span>
            </p>
            <OtpInput
              value={otp}
              onChange={setOtp}
              onComplete={(code) => {
                if (!loading) {
                  run(async () => {
                    await confirmPhoneSignupOtp(phone, code);
                    setStep("details");
                  });
                }
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                run(async () => {
                  await sendPhoneSignupOtp(phone);
                  setStep("otp");
                  setOtp("");
                })
              }
              className="text-xs font-semibold text-primary"
            >
              Resend code
            </button>
          </div>
        ) : null}

        {step === "details" ? (
          <>
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="Account type">
              <RoleSelector value={role} onSelect={setRole} />
              <PromoBadge role={role} />
            </Field>
            {ORG_REQUIRED_ROLES.has(role) ? (
              <Field label={organizationFieldLabel(role)}>
                <input
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                  placeholder={organizationFieldPlaceholder(role)}
                  className={inputCls}
                />
              </Field>
            ) : null}
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
          </>
        ) : null}

        {step === "email" ? (
          <Field label="Email (required)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail((v) => v.trim())}
              required
              className={inputCls}
              autoComplete="email"
              placeholder="You’ll use this email to sign in"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              After signup, sign in with this email and your password.
            </p>
          </Field>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
        >
          {phoneSignupSubmitLabel(loading, step)}
        </button>
      </form>

      <SignupPolicyDialog
        open={policyOpen}
        role={role}
        busy={loading}
        onClose={() => {
          if (!loading) setPolicyOpen(false);
        }}
        onAccept={() => {
          const acceptedAt = new Date().toISOString();
          setPolicyAcceptedAt(acceptedAt);
          setPolicyAcceptedRole(role);
          setPolicyOpen(false);
          run(() =>
            finishPhoneSignup({
              email,
              password,
              confirmPassword,
              fullName,
              phone,
              role,
              organizationName,
              policyAcceptedAt: acceptedAt,
              referralCode,
              navigate,
            }),
          );
        }}
      />
    </div>
  );
}
