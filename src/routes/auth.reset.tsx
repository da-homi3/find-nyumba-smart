import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OtpInput } from "@/components/auth/OtpInput";
import { resetStepSubtitle, resetStepTitle, type ResetStep } from "@/lib/auth-reset-copy";
import { scorePassword } from "@/lib/password-strength";
import { validatePasswordPair } from "@/lib/validate-password";
import { errorMessage } from "@/lib/utils";

const OTP_PATTERN = /^\d{6}$/;

export const Route = createFileRoute("/auth/reset")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
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
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(() => scorePassword(password), [password]);

  useEffect(() => {
    const hash = globalThis.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token=")) {
      setStep("password");
      setHasRecoverySession(true);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("password");
        setHasRecoverySession(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = globalThis.setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => globalThis.clearTimeout(timer);
  }, [resendSeconds]);

  async function sendResetEmail() {
    setLoading(true);
    try {
      const redirectTo = `${globalThis.location.origin}/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setResendSeconds(60);
      setStep("otp");
      toast.success("Check your email for the reset code or link.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function requestReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await sendResetEmail();
  }

  function verifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!OTP_PATTERN.test(otp)) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setStep("password");
    toast.success("Code accepted — set your new password.");
  }

  async function updatePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const passwordError = validatePasswordPair(password, confirmPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session && !hasRecoverySession) {
        toast.error("Open the reset link we emailed you, then set your new password.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password reset. Sign in with your new password.");
      navigate({ to: "/auth" });
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
        <h1 className="mt-6 font-display text-3xl font-semibold">{stepTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{stepSubtitle}</p>

        {step === "request" && (
          <form className="mt-8 space-y-4" onSubmit={requestReset}>
            <Field label="Email">
              <input
                type="email"
                required
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
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form className="mt-8 space-y-5" onSubmit={verifyOtp}>
            <OtpInput value={otp} onChange={setOtp} />
            <button
              type="submit"
              disabled={otp.length < 6}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Continue
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
                {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form className="mt-8 space-y-4" onSubmit={updatePassword}>
            <Field label="New password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
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

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1.5 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
