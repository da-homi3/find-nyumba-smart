#!/usr/bin/env node
/**
 * Add SendGrid domain authentication DNS records to Cloudflare for nyumbasearch.com.
 * Uses wrangler OAuth token from ~/.config/.wrangler/config/default.toml
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ZONE_ID = "6718302c9ada2e3389e0fbc2a1d2eb09";
const DOMAIN = "nyumbasearch.com";

const SENDGRID_RECORDS = [
  { type: "CNAME", name: "em2954", content: "u109129355.wl106.sendgrid.net", proxied: false },
  {
    type: "CNAME",
    name: "s1._domainkey",
    content: "s1.domainkey.u109129355.wl106.sendgrid.net",
    proxied: false,
  },
  {
    type: "CNAME",
    name: "s2._domainkey",
    content: "s2.domainkey.u109129355.wl106.sendgrid.net",
    proxied: false,
  },
  { type: "TXT", name: "_dmarc", content: "v=DMARC1; p=none;", proxied: false },
  { type: "CNAME", name: "url7389", content: "sendgrid.net", proxied: false },
  { type: "CNAME", name: "109129355", content: "sendgrid.net", proxied: false },
];

const OAUTH_TOKEN_RE = /oauth_token\s*=\s*"([^"]+)"/;
const ENV_TOKEN_RE = /^CLOUDFLARE_DNS_API_TOKEN=(.+)$/;

function loadEnvToken() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return null;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = ENV_TOKEN_RE.exec(line);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return process.env.CLOUDFLARE_DNS_API_TOKEN ?? null;
}

function getCloudflareToken() {
  const envToken = loadEnvToken();
  if (envToken) return envToken;

  const candidates = [
    join(homedir(), ".config", ".wrangler", "config", "default.toml"),
    join(process.env.APPDATA ?? "", "xdg.config", ".wrangler", "config", "default.toml"),
  ];
  const configPath = candidates.find((p) => existsSync(p));
  if (!configPath)
    throw new Error("No CLOUDFLARE_DNS_API_TOKEN in .env and wrangler config not found");
  const toml = readFileSync(configPath, "utf8");
  const oauthMatch = OAUTH_TOKEN_RE.exec(toml);
  const token = oauthMatch?.[1];
  if (!token) throw new Error("No CLOUDFLARE_DNS_API_TOKEN in .env and no wrangler oauth_token");
  return token;
}

async function cf(path, opts = {}) {
  const token = getCloudflareToken();
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const data = await res.json();
  return data;
}

function fqdn(name) {
  if (name === DOMAIN || name.endsWith(`.${DOMAIN}`)) return name;
  return name === "@" ? DOMAIN : `${name}.${DOMAIN}`;
}

async function listRecords() {
  const data = await cf(`/zones/${ZONE_ID}/dns_records?per_page=100`);
  if (!data.success) throw new Error(JSON.stringify(data.errors));
  return data.result;
}

async function upsertRecord(rec) {
  const fullName = fqdn(rec.name);
  const existing = (await listRecords()).find((r) => r.type === rec.type && r.name === fullName);

  const body = {
    type: rec.type,
    name: fullName,
    content: rec.content,
    ttl: 1,
    proxied: rec.type === "CNAME" ? false : undefined,
  };

  if (existing) {
    if (existing.content === rec.content && existing.proxied === false) {
      console.log(`✓ exists  ${rec.type} ${rec.name} → ${rec.content}`);
      return { action: "skip", record: existing };
    }
    const data = await cf(`/zones/${ZONE_ID}/dns_records/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!data.success) throw new Error(`PATCH ${rec.name}: ${JSON.stringify(data.errors)}`);
    console.log(`↻ updated ${rec.type} ${rec.name} → ${rec.content}`);
    return { action: "update", record: data.result };
  }

  const data = await cf(`/zones/${ZONE_ID}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!data.success) throw new Error(`POST ${rec.name}: ${JSON.stringify(data.errors)}`);
  console.log(`+ created ${rec.type} ${rec.name} → ${rec.content}`);
  return { action: "create", record: data.result };
}

async function main() {
  console.log(`Setting up SendGrid DNS for ${DOMAIN} (zone ${ZONE_ID})\n`);
  const results = [];
  for (const rec of SENDGRID_RECORDS) {
    results.push(await upsertRecord(rec));
  }
  console.log("\nDone. Verify in SendGrid → Settings → Sender Authentication → nyumbasearch.com");
  console.log(
    "Then set SENDGRID_FROM_EMAIL=hello@nyumbasearch.com and run: node scripts/sync-wrangler-env.mjs",
  );
  return results;
}

try {
  await main();
} catch (err) {
  const msg = err.message ?? String(err);
  console.error("Failed:", msg);
  if (msg.includes("Authentication") || msg.includes("10000")) {
    console.error(`
Cloudflare DNS edit requires a dedicated API token (wrangler login only has zone:read).

1. Open: https://dash.cloudflare.com/profile/api-tokens
2. Create Token → template "Edit zone DNS" → zone: nyumbasearch.com only
3. Add to .env:  CLOUDFLARE_DNS_API_TOKEN=your_token_here
4. Re-run: npm run dns:sendgrid

Or add the 6 records manually at:
https://dash.cloudflare.com/6718302c9ada2e3389e0fbc2a1d2eb09/nyumbasearch.com/dns/records
`);
  }
  process.exit(1);
}
