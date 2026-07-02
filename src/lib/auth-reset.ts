import { supabase } from "@/integrations/supabase/client";
import { getSiteUrl } from "@/lib/site";

/** Redirect URL for Supabase password recovery emails (must match Auth redirect allowlist). */
export function passwordResetRedirectUrl(): string {
  if (globalThis.location?.origin) {
    return `${globalThis.location.origin}/auth/reset`;
  }
  return `${getSiteUrl()}/auth/reset`;
}

const RECOVERY_QUERY_KEYS = ["code", "token_hash", "type", "error", "error_description"] as const;

function cleanRecoveryUrl(url: URL) {
  for (const key of RECOVERY_QUERY_KEYS) {
    url.searchParams.delete(key);
  }
  globalThis.history.replaceState({}, document.title, url.pathname + url.search);
}

function cleanRecoveryHash() {
  globalThis.history.replaceState(
    {},
    document.title,
    globalThis.location.pathname + globalThis.location.search,
  );
}

function hashParams(): URLSearchParams {
  return new URLSearchParams(globalThis.location.hash.replace(/^#/, ""));
}

function parseRecoveryHash(): { accessToken: string; refreshToken: string } | null {
  const params = hashParams();
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/** Error text when Supabase redirects with ?error= or #error= (expired/invalid link). */
export function recoveryUrlError(): string | null {
  if (globalThis.location?.href === undefined) return null;
  const url = new URL(globalThis.location.href);
  const fromQuery = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (fromQuery) return decodeURIComponent(fromQuery.replaceAll("+", " "));
  const fromHash = hashParams().get("error_description") ?? hashParams().get("error");
  if (fromHash) return decodeURIComponent(fromHash.replaceAll("+", " "));
  return null;
}

/** True when the current URL looks like a Supabase recovery callback. */
export function isPasswordRecoveryUrl(): boolean {
  if (globalThis.location?.href === undefined) return false;
  const url = new URL(globalThis.location.href);
  const hash = hashParams();
  if (url.searchParams.get("type") === "recovery") return true;
  if (hash.get("type") === "recovery") return true;
  if (url.searchParams.has("code")) return true;
  if (url.searchParams.has("token_hash")) return true;
  return hash.has("access_token");
}

/** Let the Supabase client finish detectSessionInUrl before we exchange manually. */
function waitForAuthTick(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 50);
  });
}

async function recoverFromTokenHash(url: URL, hash: URLSearchParams): Promise<boolean | null> {
  const tokenHash = url.searchParams.get("token_hash") ?? hash.get("token_hash");
  const recoveryType = url.searchParams.get("type") ?? hash.get("type");
  if (!tokenHash || recoveryType !== "recovery") return null;

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (error) {
    console.warn("[auth-reset] verifyOtp(token_hash):", error.message);
    return hasAuthSession();
  }
  cleanRecoveryUrl(url);
  cleanRecoveryHash();
  return hasAuthSession();
}

async function recoverFromCode(url: URL): Promise<boolean | null> {
  const code = url.searchParams.get("code");
  if (!code) return null;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    if (await hasAuthSession()) return true;
    console.warn("[auth-reset] exchangeCodeForSession:", error.message);
    return false;
  }
  cleanRecoveryUrl(url);
  return hasAuthSession();
}

async function recoverFromHashTokens(): Promise<boolean | null> {
  const tokens = parseRecoveryHash();
  if (!tokens) return null;

  const { error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (error) {
    console.warn("[auth-reset] setSession:", error.message);
    return false;
  }
  cleanRecoveryHash();
  return hasAuthSession();
}

/**
 * Establish a recovery session from email link (PKCE ?code=, ?token_hash=, or #access_token=).
 * Returns true only when a session is actually available.
 */
export async function bootstrapPasswordRecoverySession(): Promise<boolean> {
  if (globalThis.location?.href === undefined) return false;

  const hadRecoveryUrl = isPasswordRecoveryUrl();

  await waitForAuthTick();
  if (await hasAuthSession()) {
    // Supabase detectSessionInUrl finished before our manual exchange
    return hadRecoveryUrl;
  }

  if (!hadRecoveryUrl) return false;

  const url = new URL(globalThis.location.href);
  const hash = hashParams();

  const fromTokenHash = await recoverFromTokenHash(url, hash);
  if (fromTokenHash !== null) return fromTokenHash;

  const fromCode = await recoverFromCode(url);
  if (fromCode !== null) return fromCode;

  const fromHash = await recoverFromHashTokens();
  if (fromHash !== null) return fromHash;

  return false;
}

/** Returns true if the user currently has an auth session. */
export async function hasAuthSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[auth-reset] getSession:", error.message);
    return false;
  }
  return !!data.session;
}

/** Email from the active recovery session, if any. */
export async function recoverySessionEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}
