import { useEffect, useMemo, useState, type ReactNode, type SubmitEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OtpInput } from "@/components/auth/OtpInput";
import { resetStepSubtitle, resetStepTitle, type ResetStep } from "@/lib/auth-reset-copy";
import { scorePassword } from "@/lib/password-strength";
import { validatePasswordPair } from "@/lib/validate-password";
import {
  bootstrapPasswordRecoverySession,
  hasAuthSession,
  isPasswordRecoveryUrl,
  recoverySessionEmail,
  recoveryUrlError,
} from "@/lib/auth-reset";
import { requestPasswordReset } from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/utils";

const OTP_PATTERN = /^\d{6}$/;

const STEPS: ResetStep[] = ["request", "otp", "password"];

type Props = Readonly<{
  initialEmail?: string;
  /** Called when user cancels back to sign-in (inline mode). */
  onCancel?: () => void;
}>;

export function PasswordResetFlow({ initialEmail = "", onCancel }: Props) {
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkBootstrapping, setLinkBootstrapping] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(() => scorePassword(password), [password]);
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    let active = true;

    async function activateRecoverySession() {
      const ready = await bootstrapPasswordRecoverySession();
      if (!active) return ready;
      if (ready) {
        setSessionReady(true);
        setStep("password");
        const sessionEmail = await recoverySessionEmail();
        if (sessionEmail) setEmail(sessionEmail);
      }
      return ready;
    }

    async function initFromEmailLink() {
      const urlError = recoveryUrlError();
      if (urlError) {
        toast.error(urlError);
        setStep("request");
        return;
      }
      if (!isPasswordRecoveryUrl()) return;

      setLinkBootstrapping(true);
      setStep("password");
      const ready = await activateRecoverySession();
      if (!active) return;
      if (!ready) {
        toast.error("This reset link expired or is invalid. Request a new code.");
        setStep("request");
        setSessionReady(false);
      }
      setLinkBootstrapping(false);
    }

    void initFromEmailLink();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session) return;
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
        setStep("password");
        setLinkBootstrapping(false);
        if (session.user.email) setEmail(session.user.email);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = globalThis.setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => globalThis.clearTimeout(timer);
  }, [resendSeconds]);

  async function ensureRecoverySession(): Promise<boolean> {
    if (sessionReady && (await hasAuthSession())) return true;
    const ready = await bootstrapPasswordRecoverySession();
    if (ready) {
      setSessionReady(true);
      return true;
    }
    return false;
  }

  async function sendResetEmail() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter your email address");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset({ data: { email: trimmed } });
      setEmail(trimmed);
      setSessionReady(false);
      setOtp("");
      setResendSeconds(60);
      setStep("otp");
      toast.success("If that email is registered, we sent a 6-digit reset code.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function requestReset(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    await sendResetEmail();
  }

  async function verifyOtp(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!OTP_PATTERN.test(otp)) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter the email you used to request a reset");
      setStep("request");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: otp,
        type: "recovery",
      });
      if (error) throw error;
      const authed = !!(data.session ?? (await hasAuthSession()));
      if (!authed) {
        throw new Error("Code accepted but session could not start. Request a new code.");
      }
      setSessionReady(true);
      setStep("password");
      toast.success("Code verified — choose your new password.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const passwordError = validatePasswordPair(password, confirmPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setLoading(true);
    try {
      const authed = await ensureRecoverySession();
      if (!authed) {
        toast.error("Your reset session expired. Enter a new code from your email.");
        setStep("otp");
        setSessionReady(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Password updated. Sign in with your new password.");
      navigate({ to: "/auth", search: { redirect: "/tenant", mode: "signin" } });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <li key={s} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s === "request" ? "Email" : s === "otp" ? "Code" : "Password"}
              </span>
            </li>
          );
        })}
      </ol>

      <h2 className="font-display text-xl font-semibold">{resetStepTitle(step)}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{resetStepSubtitle(step, email)}</p>

      {step === "request" && (
        <form className="mt-6 space-y-4" onSubmit={requestReset}>
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Sending code…" : "Send reset code"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              ← Back to sign in
            </button>
          )}
        </form>
      )}

      {step === "otp" && (
        <form className="mt-6 space-y-5" onSubmit={verifyOtp}>
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            Check your inbox for a <strong className="text-foreground">6-digit code</strong>. Enter
            it below to continue.
          </p>
          <Field label="Reset code">
            <OtpInput value={otp} onChange={setOtp} />
          </Field>
          <button
            type="submit"
            disabled={otp.length < 6 || loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify code & continue"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setStep("request")}
              className="font-semibold text-muted-foreground hover:text-foreground"
            >
              ← Change email
            </button>
            <button
              type="button"
              disabled={resendSeconds > 0 || loading}
              onClick={() => void sendResetEmail()}
              className="font-semibold text-primary disabled:opacity-50"
            >
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {step === "password" && linkBootstrapping && (
        <div className="mt-10 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          Confirming your reset session…
        </div>
      )}

      {step === "password" && !linkBootstrapping && !sessionReady && (
        <div className="mt-8 rounded-2xl border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Enter the code from your email first so we can update your password securely.
          </p>
          <button
            type="button"
            onClick={() => {
              setStep("otp");
              setSessionReady(false);
            }}
            className="mt-4 text-sm font-semibold text-primary"
          >
            Enter reset code
          </button>
        </div>
      )}

      {step === "password" && !linkBootstrapping && sessionReady && (
        <form className="mt-6 space-y-4" onSubmit={updatePassword}>
          {email && (
            <p className="text-xs text-muted-foreground">
              Updating password for <span className="font-medium text-foreground">{email}</span>
            </p>
          )}
          <Field label="New password">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${strength.barClass}`}
                style={{ width: `${Math.min(100, (strength.score / 5) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{strength.label}</p>
          </div>
          <Field label="Confirm new password">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Updating password…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1.5 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
