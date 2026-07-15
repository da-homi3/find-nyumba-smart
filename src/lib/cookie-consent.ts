export const CONSENT_KEY = "ns_consent";

export type ConsentPrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  version: string;
};

export const NECESSARY_ONLY_CONSENT: ConsentPrefs = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
  version: "1.0",
};

export function getStoredConsent(): ConsentPrefs | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentPrefs;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  const stored = getStoredConsent();
  // Default on until the visitor chooses Essential only (or unchecks Analytics).
  if (!stored) return true;
  return stored.analytics === true;
}

export async function persistConsentPrefs(prefs: ConsentPrefs): Promise<void> {
  try {
    await fetch("/api/cookie-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  } catch {
    // still store locally
  }
  localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ns:consent-updated"));
  }
}
