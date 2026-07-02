import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

const CONSENT_KEY = "ns_consent";

type ConsentPrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  version: string;
};

const PREF_OPTIONS = [
  ["analytics", "Analytics", "Help us understand how the site is used"],
  ["marketing", "Marketing", "Personalised emails and promotions"],
  ["preferences", "Preferences", "Remember your filters and settings"],
] as const;

export function CookieConsentBanner() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState({
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (visible && !dialog.open) dialog.showModal();
    if (!visible && dialog.open) dialog.close();
  }, [visible]);

  async function saveConsent(all: boolean) {
    const payload: ConsentPrefs = {
      necessary: true,
      analytics: all ? true : prefs.analytics,
      marketing: all ? true : prefs.marketing,
      preferences: all ? true : prefs.preferences,
      version: "1.0",
    };

    try {
      await fetch("/api/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // still store locally
    }

    localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-x-0 bottom-0 z-9999 m-0 w-full max-w-none border-t border-white/10 bg-background/95 p-4 backdrop-blur-md open:flex open:flex-col"
      aria-label="Cookie consent"
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted-foreground">
          We use cookies for essential features and optional analytics. See our{" "}
          <Link to="/cookie-policy" className="font-medium text-primary hover:underline">
            Cookie Policy
          </Link>
          .
        </p>

        {showDetails ? (
          <div className="mt-3 space-y-2 text-sm">
            {PREF_OPTIONS.map(([key, label, desc]) => (
              <label key={key} htmlFor={`consent-${key}`} className="flex items-start gap-2">
                <input
                  id={`consent-${key}`}
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                  className="mt-1"
                  aria-label={label}
                />
                <span>
                  <span className="font-medium text-foreground">{label}</span>
                  <span className="text-muted-foreground"> — {desc}</span>
                </span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveConsent(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => void saveConsent(false)}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {showDetails ? "Hide" : "Manage"} preferences
          </button>
        </div>
      </div>
    </dialog>
  );
}
