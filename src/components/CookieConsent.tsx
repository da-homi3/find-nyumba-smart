import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  CONSENT_KEY,
  NECESSARY_ONLY_CONSENT,
  persistConsentPrefs,
  type ConsentPrefs,
} from "@/lib/cookie-consent";

const PREF_OPTIONS = [
  ["analytics", "Analytics", "Help us understand how the site is used"],
  ["marketing", "Marketing", "Personalised emails and promotions"],
  ["preferences", "Preferences", "Remember your filters and settings"],
] as const;

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState({
    analytics: true,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  async function saveConsent(all: boolean) {
    const payload: ConsentPrefs = {
      necessary: true,
      analytics: all ? true : prefs.analytics,
      marketing: all ? true : prefs.marketing,
      preferences: all ? true : prefs.preferences,
      version: "1.0",
    };

    await persistConsentPrefs(payload);
    setVisible(false);
  }

  async function dismissNecessaryOnly() {
    await persistConsentPrefs(NECESSARY_ONLY_CONSENT);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
      aria-label="Cookie consent"
    >
      <div className="pointer-events-auto border-t border-white/10 bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="relative mx-auto max-w-3xl pr-10">
          <button
            type="button"
            onClick={() => void dismissNecessaryOnly()}
            className="absolute right-0 top-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Continue with essential cookies only"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-sm text-muted-foreground">
            We use essential cookies so NyumbaSearch works. Optional analytics and marketing cookies
            are off unless you opt in. See our{" "}
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
            {showDetails ? (
              <button
                type="button"
                onClick={() => void saveConsent(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Save my choices
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void dismissNecessaryOnly()}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Essential only
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {showDetails ? "Hide" : "Manage"} preferences
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
