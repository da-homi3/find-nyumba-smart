import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { BrandLogoLink } from "@/components/BrandLogo";
import { useAuth } from "@/hooks/use-auth";
import { useProfilePhone, useSaveAccountPhone } from "@/hooks/use-profile-phone";
import { shouldSkipPhoneGate } from "@/lib/auth/auth-gate";
import { formatKenyanPhoneHint, isKenyanPhone } from "@/lib/phone";
import { errorMessage } from "@/lib/utils";
import { withTimeoutOrThrow } from "@/lib/auth/with-timeout";

const inputCls =
  "min-h-11 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";

/**
 * Closed dialogs must stay `hidden`. A bare Tailwind `flex` overrides the UA
 * `dialog:not([open]) { display: none }` and leaves an invisible full-screen
 * layer that blocks all taps on the app.
 */
const dialogCls =
  "fixed inset-0 z-50 m-0 hidden h-dvh max-h-dvh w-full max-w-none items-end justify-center border-0 bg-black/55 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] open:flex sm:items-center backdrop:bg-transparent";

/**
 * After Google (or any) sign-in without a phone, require one before using the app.
 * Non-dismissible until a valid Kenyan number is saved (sign out is the escape hatch).
 */
export function RequireAccountPhoneModal() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { hasPhone, loading: phoneLoading } = useProfilePhone();
  const savePhone = useSaveAccountPhone();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedThisSession, setSavedThisSession] = useState(false);
  const [phoneWaitTimedOut, setPhoneWaitTimedOut] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setSavedThisSession(false);
    setPhoneWaitTimedOut(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !phoneLoading || hasPhone) return;
    const t = globalThis.setTimeout(() => setPhoneWaitTimedOut(true), 4000);
    return () => globalThis.clearTimeout(t);
  }, [user, phoneLoading, hasPhone]);

  const open = Boolean(
    user &&
      !authLoading &&
      (!phoneLoading || phoneWaitTimedOut) &&
      !hasPhone &&
      !savedThisSession &&
      !shouldSkipPhoneGate(pathname),
  );

  useEffect(() => {
    if (!open) setPhone("");
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isKenyanPhone(phone)) {
      toast.error(`Enter a valid Kenyan mobile (${formatKenyanPhoneHint()})`);
      return;
    }
    setSubmitting(true);
    try {
      await withTimeoutOrThrow(savePhone(phone), 10_000, "Saving phone timed out. Try again.");
      setSavedThisSession(true);
      dialogRef.current?.close();
      toast.success("Phone number saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSignOut() {
    try {
      await signOut();
      dialogRef.current?.close();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="require-phone-title"
      className={dialogCls}
      onCancel={(e) => e.preventDefault()}
    >
      <div className="pointer-events-auto relative z-10 w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex justify-center">
          <BrandLogoLink logoClassName="h-8" />
        </div>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Phone className="h-5 w-5" aria-hidden />
        </div>
        <h2 id="require-phone-title" className="text-center font-display text-xl font-semibold">
          Add your phone number
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We need a Kenyan mobile on your account for M-Pesa payments, landlord contact, and
          account security - even when you sign in with Google.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">Mobile number</span>
            <input
              type="tel"
              required
              autoFocus={open}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting || !open}
              placeholder="0712 345 678"
              className={inputCls}
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="done"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {formatKenyanPhoneHint()}
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !open}
            className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save phone number"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void onSignOut()}
          className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
        >
          Sign out instead
        </button>
      </div>
    </dialog>
  );
}
