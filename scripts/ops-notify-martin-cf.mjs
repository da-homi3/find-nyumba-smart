/**
 * Send Martin notification via Cloudflare Email Sending REST API (wrangler OAuth).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ACCOUNT_ID = "7ff77105e5fd9fb5f560d381ec562ed8";
const TO = "martinadwogo@gmail.com";

function loadWranglerOauthToken() {
  const candidates = [
    join(homedir(), "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml"),
    join(homedir(), ".wrangler", "config", "default.toml"),
    join(homedir(), ".config", ".wrangler", "config", "default.toml"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    const m = raw.match(/oauth_token\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return null;
}

function loadEnv() {
  const env = {};
  const p = join(root, ".env");
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

async function main() {
  const env = loadEnv();
  const token = env.CLOUDFLARE_API_TOKEN || loadWranglerOauthToken();
  if (!token) throw new Error("No Cloudflare API/OAuth token");

  const text = readFileSync(join(root, "scripts", "_martin-notify.txt"), "utf8");
  const html = readFileSync(join(root, "scripts", "_martin-notify.html"), "utf8");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: TO,
        from: { address: "hello@nyumbasearch.com", name: "NyumbaSearch" },
        reply_to: { address: "hello@nyumbasearch.com", name: "NyumbaSearch" },
        subject: "You're approved as an Independent Agent — NyumbaSearch pilot",
        text,
        html,
      }),
    },
  );
  const body = await res.text();
  console.log(res.status, body);
  if (!res.ok) process.exit(1);

  // Also create in-app notification
  const { createClient } = await import("@supabase/supabase-js");
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    await admin.from("notifications").insert({
      user_id: "17e5db71-a84b-4b1a-b548-eb6539489660",
      type: "portal",
      title: "You're an Independent Agent",
      body: "Your account was upgraded to Independent Agent and enrolled in the pilot. Open your agent dashboard.",
      href: "/agent/dashboard",
    });
    console.log("in-app notification created");
  }
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
