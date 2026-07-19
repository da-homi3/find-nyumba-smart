import { useEffect, useState, type SubmitEvent } from "react";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registerAccountSignup } from "@/lib/api/auth.functions";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { BrandLogoLink } from "@/components/BrandLogo";
import {
  clearAuthGateDismiss,
  dismissAuthGateThisSession,
  isAuthGateDismissedThisSession,
  shouldSkipAuthGate,
} from "@/lib/auth/auth-gate";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { isKenyanPhone } from "@/lib/phone";
import { validatePasswordPair } from "@/lib/validate-password";
import { authSubmitLabel, errorMessage } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

/**
 * Global sign-in / sign-up popup for unsigned visitors.
 * Signup via this modal (email or Google) is always as a tenant.
 */
export function AuthGateModal() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      clearAuthGateDismiss();
      setOpen(false);
      return;
    }
    if (shouldSkipAuthGate(pathname)) {
      setOpen(false);
      return;
    }
    if (isAuthGateDismissedThisSession()) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [user, loading, pathname]);

  if (!open || user || loading) return null;

  function dismiss() {
    dismissAuthGateThisSession();
    setOpen(false);
  }

  async function handleSignup() {
    const passwordError = validatePasswordPair(password, confirmPassword);
    if (passwordError) throw new Error(passwordError);
    if (fullName.trim().length < 2) throw new Error("Enter your full name");
    if (!isKenyanPhone(phone)) {
      throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
    }

    await registerAccountSignup({
      data: {
        email,
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: "tenant",
      },
    });

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    try {
      await ensureTenantAccount();
    } catch (err) {
      console.warn("[auth-gate] ensureTenantAccount:", err);
    }

    markSignupTourPending("tenant");
    toast.success("Welcome to NyumbaSearch!");
    clearAuthGateDismiss();
    globalThis.location.href = "/tenant";
  }

  async function handleSignin() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Sign in failed");

    try {
      await ensureTenantAccount();
    } catch (err) {
      console.warn("[auth-gate] ensureTenantAccount:", err);
    }

    clearAuthGateDismiss();
    toast.success("Signed in");
    setOpen(false);
    if (pathname === "/" || pathname.startsWith("/auth")) {
      globalThis.location.href = "/tenant";
    } else {
      globalThis.location.reload();
    }
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const run = mode === "signup" ? handleSignup : handleSignin;
    void run()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setSubmitting(false));
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Continue browsing"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-6 pt-7">
          <BrandLogoLink logoClassName="h-8" />
          <h2 id="auth-gate-title" className="mt-4 font-display text-2xl font-semibold">
            {mode === "signup" ? "Create your tenant account" : "Welcome back"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Sign up to save homes, message landlords, and unlock contacts. You’re joining as a tenant."
              : "Sign in to continue where you left off."}
          </p>

          <div className="mt-5 flex rounded-xl border bg-secondary p-1">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                  mode === m ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "signup" ? "Sign up" : "Sign in"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <GoogleAuthButton
              nextPath="/tenant"
              label={mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
              disabled={submitting}
            />
          </div>

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Full name</span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={inputCls}
                    autoComplete="name"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Phone (M-Pesa)
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XX XXX XXX"
                    required
                    className={inputCls}
                    autoComplete="tel"
                  />
                </label>
              </>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputCls}
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : 6}
                className={inputCls}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </label>

            {mode === "signup" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Confirm password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className={inputCls}
                  autoComplete="new-password"
                />
              </label>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {authSubmitLabel(submitting, mode)}
            </button>
          </form>

          <button
            type="button"
            onClick={dismiss}
            className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Continue browsing without an account
          </button>
        </div>
      </div>
    </div>
  );
}
