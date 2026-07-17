const SESSION_KEY = "nyumba_session_id";

export function getAnonymousSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}
