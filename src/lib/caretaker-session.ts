const SESSION_KEY = "nyumba_caretaker_token";

export function getCaretakerToken(): string | null {
  if (globalThis.localStorage === undefined) return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setCaretakerToken(token: string) {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearCaretakerToken() {
  localStorage.removeItem(SESSION_KEY);
}

export function isCaretakerSessionPresent(): boolean {
  return !!getCaretakerToken();
}
