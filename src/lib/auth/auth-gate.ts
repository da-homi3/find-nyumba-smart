import { getSiteUrl } from "@/lib/site";

const OAUTH_ROLE_KEY = "ns_oauth_role";
const OAUTH_NEXT_KEY = "ns_oauth_next";
const AUTH_GATE_DISMISS_KEY = "ns_auth_gate_dismissed";

export function oauthCallbackUrl(nextPath = "/tenant"): string {
  const origin =
    typeof globalThis.location?.origin === "string" && globalThis.location.origin
      ? globalThis.location.origin
      : getSiteUrl();
  const next = nextPath.startsWith("/") ? nextPath : "/tenant";
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function rememberOAuthIntent(role: "tenant" = "tenant", nextPath = "/tenant") {
  try {
    sessionStorage.setItem(OAUTH_ROLE_KEY, role);
    sessionStorage.setItem(OAUTH_NEXT_KEY, nextPath.startsWith("/") ? nextPath : "/tenant");
  } catch {
    // ignore
  }
}

export function consumeOAuthIntent(): { role: "tenant"; next: string } {
  let next = "/tenant";
  try {
    const storedNext = sessionStorage.getItem(OAUTH_NEXT_KEY);
    if (storedNext?.startsWith("/")) next = storedNext;
    sessionStorage.removeItem(OAUTH_ROLE_KEY);
    sessionStorage.removeItem(OAUTH_NEXT_KEY);
  } catch {
    // ignore
  }
  return { role: "tenant" as const, next };
}

export function isAuthGateDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(AUTH_GATE_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissAuthGateThisSession() {
  try {
    sessionStorage.setItem(AUTH_GATE_DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearAuthGateDismiss() {
  try {
    sessionStorage.removeItem(AUTH_GATE_DISMISS_KEY);
  } catch {
    // ignore
  }
}

/** Paths where the global auth popup should not appear. */
export function shouldSkipAuthGate(pathname: string): boolean {
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/caretaker")) return true;
  if (
    pathname === "/privacy" ||
    pathname === "/terms-of-service" ||
    pathname === "/cookie-policy" ||
    pathname === "/data-deletion" ||
    pathname === "/about"
  ) {
    return true;
  }
  return false;
}

/** Paths where the mandatory phone modal can be skipped (user is already editing profile). */
export function shouldSkipPhoneGate(pathname: string): boolean {
  if (shouldSkipAuthGate(pathname)) return true;
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/tenant/profile")) return true;
  return false;
}
