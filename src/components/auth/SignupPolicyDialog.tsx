import { useEffect, useState } from "react";
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

export function SignupPolicyDialog({ open, role, busy = false, onClose, onAccept }: Props) {
  const [checked, setChecked] = useState(false);
  const policy = signupPolicyForRole(role);

  useEffect(() => {
    if (open) setChecked(false);
  }, [open, role]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close policy"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Terms and conditions
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{policy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{policy.intro}</p>
        </div>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
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
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="border-t bg-background px-6 py-5">
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span>
              I confirm that I have read and agree to these terms, understand how NyumbaSearch
              works for this account type, and will use the platform in line with these conditions.
            </span>
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-input px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!checked || busy}
              onClick={onAccept}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Accept and continue"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Policy version: current at signup. Acceptance is recorded against your account.
          </p>
        </div>
      </div>
    </div>
  );
}
