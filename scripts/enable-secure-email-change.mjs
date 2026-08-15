import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const ref = env.SUPABASE_PROJECT_REF;
const token = env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const base = `https://api.supabase.com/v1/projects/${ref}`;

async function api(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 800)}`);
  }
  return json;
}

// Auth config endpoints vary by API version; try known paths.
const candidates = [
  "/config/auth",
  "/auth/config",
];

let config = null;
let usedPath = null;
for (const path of candidates) {
  try {
    config = await api("GET", path);
    usedPath = path;
    break;
  } catch (e) {
    console.log(String(e.message).slice(0, 200));
  }
}

if (!config) {
  console.error("Could not read auth config via Management API");
  process.exit(1);
}

console.log("Read auth config from", usedPath);
const keys = Object.keys(config);
console.log("Top-level keys:", keys.join(", "));

const interesting = [
  "MAILER_SECURE_EMAIL_CHANGE_ENABLED",
  "secure_email_change_enabled",
  "SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION",
  "mailer_secure_email_change_enabled",
  "DISABLE_SIGNUP",
];
for (const k of interesting) {
  if (k in config) console.log(`${k}=`, config[k]);
}

// Dump nested mailer/security related fields
function findKeys(obj, prefix = "") {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (/email.?change|secure.?email|mailer/i.test(k)) {
      console.log(`${p}=`, JSON.stringify(v));
    }
    if (v && typeof v === "object" && !Array.isArray(v) && prefix.split(".").length < 3) {
      findKeys(v, p);
    }
  }
}
findKeys(config);

const patchBody = {
  ...("MAILER_SECURE_EMAIL_CHANGE_ENABLED" in config
    ? { MAILER_SECURE_EMAIL_CHANGE_ENABLED: true }
    : {}),
  ...("secure_email_change_enabled" in config
    ? { secure_email_change_enabled: true }
    : {}),
  ...("mailer_secure_email_change_enabled" in config
    ? { mailer_secure_email_change_enabled: true }
    : {}),
};

if (Object.keys(patchBody).length === 0) {
  // Try common PATCH payload used by Supabase dashboard
  patchBody.MAILER_SECURE_EMAIL_CHANGE_ENABLED = true;
}

console.log("Patching with", patchBody);
const updated = await api("PATCH", usedPath, patchBody);
console.log("Updated. Secure email change related:");
findKeys(updated);
if (typeof updated === "object") {
  for (const k of Object.keys(patchBody)) {
    console.log(`after ${k}=`, updated[k]);
  }
}
console.log("OK");
