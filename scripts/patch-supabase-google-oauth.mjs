#!/usr/bin/env node
/**
 * Patch Supabase Auth Google provider + redirect allow-list.
 *
 * Usage:
 *   node scripts/patch-supabase-google-oauth.mjs --client-id=... --client-secret=...
 *
 * Requires SUPABASE_ACCESS_TOKEN in env or .env
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "fnycwcbxorhreidhbers";
const SITE_URL = "https://nyumbasearch.com";
const URI_ALLOW_LIST = [
  "https://nyumbasearch.com/**",
  "https://www.nyumbasearch.com/**",
  "https://nyumbasearch.com/auth/callback",
  "https://www.nyumbasearch.com/auth/callback",
  "https://nyumbasearch.com/auth/reset",
  "https://www.nyumbasearch.com/auth/reset",
  "http://localhost:3000/**",
  "http://localhost:5173/**",
  "http://127.0.0.1:3000/**",
  "http://127.0.0.1:5173/**",
].join(",");

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // ignore
  }
}

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

loadDotEnv();

const clientId = arg("client-id") || process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = arg("client-secret") || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}
if (!clientId || !clientSecret) {
  console.error("Missing --client-id / --client-secret (or GOOGLE_OAUTH_* env)");
  process.exit(1);
}
if (!clientId.endsWith(".apps.googleusercontent.com")) {
  console.error(
    `Client ID looks wrong: "${clientId}" (expected *.apps.googleusercontent.com)`,
  );
  process.exit(1);
}

const body = {
  site_url: SITE_URL,
  uri_allow_list: URI_ALLOW_LIST,
  external_google_enabled: true,
  external_google_client_id: clientId,
  external_google_secret: clientSecret,
};

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

if (!res.ok) {
  console.error("PATCH failed", res.status, await res.text());
  process.exit(1);
}

const cfg = await res.json();
console.log(
  JSON.stringify(
    {
      ok: true,
      site_url: cfg.site_url,
      uri_allow_list: cfg.uri_allow_list,
      external_google_enabled: cfg.external_google_enabled,
      external_google_client_id: cfg.external_google_client_id,
      has_secret: Boolean(cfg.external_google_secret),
      google_redirect_uri: `https://${PROJECT_REF}.supabase.co/auth/v1/callback`,
    },
    null,
    2,
  ),
);
