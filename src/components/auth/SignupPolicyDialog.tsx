import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AccountRole } from "@/lib/account-roles";
import { signupPolicyForRole } from "@/lib/auth/signup-policy";

type Props = Readonly<{
  open: boolean;
  role: AccountRole;
  busy?: boolean;
  onClose: () => void;
  onAccept: () => void;
}>;

/** Closed dialogs stay `hidden` so they never block taps behind an invisible overlay. */
const dialogCls =
  "fixed inset-0 z-90 m-0 hidden h-dvh max-h-dvh w-full max-w-none items-end justify-center border-0 bg-black/70 p-3 open:flex sm:items-center sm:p-6 backdrop:bg-transparent";

export function SignupPolicyDialog({ open, role, busy = false, onClose, onAccept }: Props) {
  const [checked, setChecked] = useState(false);
  const policy = signupPolicyForRole(role);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) setChecked(false);
  }, [open, role]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={dialogCls}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="relative flex max-h-[min(100dvh-1.5rem,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          aria-label="Close policy"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6 sm:py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Terms and conditions
          </p>
          <h2 id={titleId} className="mt-2 text-xl font-semibold text-foreground">
            {policy.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{policy.intro}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
          {policy.sections.map((section) => (
            <section key={section.title}>
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-6 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="shrink-0 border-t bg-background px-5 py-4 sm:px-6 sm:py-5">
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span>
              I confirm that I have read and agree to these terms, understand how NyumbaSearch works
              for this account type, and will use the platform in line with these conditions.
            </span>
          </label>

          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-input px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50 sm:py-2.5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!checked || busy}
              onClick={onAccept}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:py-2.5"
            >
              {busy ? "Please wait…" : "Accept & Continue"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Policy version: current at signup. Acceptance is recorded against your account.
          </p>
        </div>
      </div>
    </dialog>
  );
}
