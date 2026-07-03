import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode, type SubmitEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
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
import { BrandLogoLink } from "@/components/BrandLogo";
import { errorMessage } from "@/lib/utils";

const OTP_PATTERN = /^\d{6}$/;

const resetSearchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/reset")({
  validateSearch: (search: Record<string, unknown>) => {
    const parsed = resetSearchSchema.safeParse(search);
    const raw = parsed.success ? parsed.data.email?.trim() : undefined;
    if (!raw?.includes("@")) return { email: undefined };
    return { email: raw };
  },
  head: () => ({ meta: [{ title: "Reset password — NyumbaSearch" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { email: emailFromUrl } = Route.useSearch();
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState(emailFromUrl ?? "");
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

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl);
  }, [emailFromUrl]);

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
        toast.error("This reset link expired or is invalid. Request a new reset email.");
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
      setResendSeconds(60);
      setStep("otp");
      toast.success("If that email is registered, we sent a 6-digit code and reset link.");
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
      toast.error("Enter the 6-digit code");
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
        throw new Error(
          "Code accepted but session could not start. Use the link in your email instead.",
        );
      }
      setSessionReady(true);
      setStep("password");
      toast.success("Code verified — set your new password.");
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
        toast.error(
          "Your reset session expired. Open the link in your email again, or request a new code.",
        );
        setStep("request");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Password updated. Sign in with your new password.");
      navigate({ to: "/auth", search: { redirect: "/tenant" } });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const stepTitle = resetStepTitle(step);
  const stepSubtitle = resetStepSubtitle(step, email);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <BrandLogoLink className="mt-6" logoClassName="h-10" />
        <h1 className="mt-6 font-display text-3xl font-semibold">{stepTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{stepSubtitle}</p>

        {step === "request" && (
          <form className="mt-8 space-y-4" onSubmit={requestReset}>
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset email"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form className="mt-8 space-y-5" onSubmit={verifyOtp}>
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your email, or open the reset link in that email instead.
            </p>
            <OtpInput value={otp} onChange={setOtp} />
            <button
              type="submit"
              disabled={otp.length < 6 || loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify code"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep("request")}
                className="font-semibold text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={resendSeconds > 0 || loading}
                onClick={() => void sendResetEmail()}
                className="font-semibold text-primary disabled:opacity-50"
              >
                {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend email"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && linkBootstrapping && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            Confirming your reset link…
          </div>
        )}

        {step === "password" && !linkBootstrapping && !sessionReady && (
          <div className="mt-10 rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Your reset session is not active. Request a new code or open the link in your email.
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setSessionReady(false);
              }}
              className="mt-4 text-sm font-semibold text-primary"
            >
              Request reset email
            </button>
          </div>
        )}

        {step === "password" && !linkBootstrapping && sessionReady && (
          <form className="mt-8 space-y-4" onSubmit={updatePassword}>
            {email && (
              <p className="text-xs text-muted-foreground">
                Resetting password for <span className="font-medium text-foreground">{email}</span>
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
            <Field label="Confirm password">
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
              {loading ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
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
