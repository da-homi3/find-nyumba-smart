import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registerAccountSignup } from "@/lib/api/auth.functions";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { SignupPolicyDialog } from "@/components/auth/SignupPolicyDialog";
import { BrandLogoLink } from "@/components/BrandLogo";
import {
  clearAuthGateDismiss,
  dismissAuthGateThisSession,
  isAuthGateDismissedThisSession,
  shouldSkipAuthGate,
} from "@/lib/auth/auth-gate";
import { SIGNUP_POLICY_VERSION } from "@/lib/auth/signup-policy";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { isKenyanPhone } from "@/lib/phone";
import { validatePasswordPair } from "@/lib/validate-password";
import { authSubmitLabel, errorMessage } from "@/lib/utils";
import { normalizeAuthCredentials } from "@/lib/auth/credentials";

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";

/** Closed dialogs must stay `hidden` so they never block taps. */
const dialogCls =
  "fixed inset-0 z-70 m-0 hidden h-dvh max-h-dvh w-full max-w-none items-end justify-center border-0 bg-black/55 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] open:flex sm:items-center sm:p-6 backdrop:bg-transparent";

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
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyAcceptedAt, setPolicyAcceptedAt] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"email" | "google" | null>(null);
  const [googleStartSignal, setGoogleStartSignal] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function dismiss() {
    dismissAuthGateThisSession();
    setOpen(false);
  }

  async function handleSignup() {
    if (fullName.trim().length < 2) throw new Error("Enter your full name");
    if (!isKenyanPhone(phone)) {
      throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
    }

    const { email: cleanEmail, password: cleanPassword } = normalizeAuthCredentials({
      email,
      password,
    });
    const passwordError = validatePasswordPair(cleanPassword, confirmPassword.trim());
    if (passwordError) throw new Error(passwordError);

    await registerAccountSignup({
      data: {
        email: cleanEmail,
        password: cleanPassword,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: "tenant",
        acceptedPolicyVersion: SIGNUP_POLICY_VERSION,
        acceptedPolicyAt: policyAcceptedAt ?? new Date().toISOString(),
      },
    });

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });
    if (signInError) throw signInError;

    void ensureTenantAccount().catch((err) => {
      console.warn("[auth-gate] ensureTenantAccount:", err);
    });

    markSignupTourPending("tenant");
    toast.success("Welcome to NyumbaSearch!");
    clearAuthGateDismiss();
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

    void ensureTenantAccount().catch((err) => {
      console.warn("[auth-gate] ensureTenantAccount:", err);
    });

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
    if (mode === "signup" && !policyAcceptedAt) {
      setPendingAction("email");
      setPolicyOpen(true);
      return;
    }
    setSubmitting(true);
    const hardStopMs = 60_000;
    const hardStop = globalThis.setTimeout(() => {
      setSubmitting(false);
      toast.error(
        mode === "signup"
          ? "Sign-up is taking too long. Check your connection and try again."
          : "Sign-in is taking too long. Check your connection and try again.",
      );
    }, hardStopMs);
    const run = mode === "signup" ? handleSignup : handleSignin;
    void run()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => {
        globalThis.clearTimeout(hardStop);
        setSubmitting(false);
      });
  }

  function closePolicy() {
    if (submitting) return;
    setPolicyOpen(false);
    setPendingAction(null);
  }

  function acceptPolicy() {
    const acceptedAt = new Date().toISOString();
    setPolicyAcceptedAt(acceptedAt);
    setPolicyOpen(false);

    if (pendingAction === "google") {
      setPendingAction(null);
      setGoogleStartSignal((value) => value + 1);
      return;
    }

    if (pendingAction === "email") {
      setPendingAction(null);
      setSubmitting(true);
      const hardStop = globalThis.setTimeout(() => {
        setSubmitting(false);
        toast.error("Sign-up is taking too long. Check your connection and try again.");
      }, 45_000);
      void handleSignup()
        .catch((err) => toast.error(errorMessage(err)))
        .finally(() => {
          globalThis.clearTimeout(hardStop);
          setSubmitting(false);
        });
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="auth-gate-title"
        className={dialogCls}
        onCancel={(e) => {
          e.preventDefault();
          dismiss();
        }}
      >
        <div className="pointer-events-auto relative z-10 flex max-h-[min(100dvh-1.5rem,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Continue browsing"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-7">
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
                onBeforeStart={() => {
                  if (mode !== "signup" || policyAcceptedAt) return true;
                  setPendingAction("google");
                  setPolicyOpen(true);
                  return false;
                }}
                startSignal={googleStartSignal}
                policyAcceptance={
                  mode === "signup" && policyAcceptedAt
                    ? {
                        role: "tenant",
                        version: SIGNUP_POLICY_VERSION,
                        acceptedAt: policyAcceptedAt,
                      }
                    : undefined
                }
              />
            </div>

            <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span>or email</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "signup" ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Full name
                    </span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className={inputCls}
                      autoComplete="name"
                      enterKeyHint="next"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Phone (M-Pesa)
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      required
                      className={inputCls}
                      autoComplete="tel"
                      inputMode="tel"
                      enterKeyHint="next"
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
                  onBlur={() => setEmail((v) => v.trim())}
                  required
                  className={inputCls}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  enterKeyHint="next"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Password
                </span>
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
                  enterKeyHint={mode === "signup" ? "next" : "go"}
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
                    enterKeyHint="go"
                  />
                </label>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
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
      </dialog>
      {policyOpen ? (
        <SignupPolicyDialog
          open={policyOpen}
          role="tenant"
          busy={submitting}
          onClose={closePolicy}
          onAccept={acceptPolicy}
        />
      ) : null}
    </>
  );
}
