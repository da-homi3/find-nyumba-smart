/**
 * Create a Mapbox public token for NyumbaSearch 3D map.
 *
 * Prerequisites:
 *   1. Free account at https://account.mapbox.com/auth/signup
 *   2. Default public token OR secret token (sk.*) with tokens:write
 *
 * Usage:
 *   node scripts/provision-mapbox.mjs
 *   MAPBOX_SECRET_TOKEN=sk.ey... node scripts/provision-mapbox.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const SCOPES = [
  "styles:read",
  "styles:tiles",
  "fonts:read",
  "datasets:read",
  "vision:read",
  "tilesets:read",
];

function parseEnv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function upsertEnv(key, value) {
  const original = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const lines = original.split("\n");
  let found = false;
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) out.push(`${key}=${value}`);
  writeFileSync(envPath, out.join("\n").replace(/\n*$/, "\n"));
}

async function getUsername(secretToken) {
  const res = await fetch(`https://api.mapbox.com/tokens/v2?access_token=${secretToken}`);
  if (!res.ok) throw new Error(`Could not list tokens (${res.status})`);
  const data = await res.json();
  return data[0]?.owner ?? null;
}

async function createPublicToken(secretToken, username) {
  const res = await fetch(
    `https://api.mapbox.com/tokens/v2/${username}?access_token=${secretToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: "NyumbaSearch 3D map (public)",
        scopes: SCOPES,
        allowedUrls: [
          "https://nyumba-search.kevinbuluma1.workers.dev",
          "http://localhost:*",
          "http://127.0.0.1:*",
        ],
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token create failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function main() {
  const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};

  const existing = env.MAPBOX_PUBLIC_TOKEN?.trim() || env.VITE_MAPBOX_TOKEN?.trim() || "";

  if (existing.startsWith("pk.")) {
    console.log("Mapbox public token already in .env");
    return;
  }

  const secret = env.MAPBOX_SECRET_TOKEN?.trim();
  if (!secret?.startsWith("sk.")) {
    console.error(`
No Mapbox token found.

1. Sign up (free): https://account.mapbox.com/auth/signup
2. Open Access tokens: https://account.mapbox.com/access-tokens/
3. Copy your **Default public token** (starts with pk.ey...)
   OR create a secret token with tokens:write and add to .env:
      MAPBOX_SECRET_TOKEN=sk.ey...

Then re-run: node scripts/provision-mapbox.mjs
`);
    process.exit(1);
  }

  const username = env.MAPBOX_USERNAME?.trim() || (await getUsername(secret));
  if (!username) throw new Error("Could not resolve Mapbox username");

  console.log(`Creating public token for user: ${username}`);
  const token = await createPublicToken(secret, username);
  const publicToken = token.token;
  if (!publicToken?.startsWith("pk.")) {
    throw new Error("Unexpected token response — expected public pk.* token");
  }

  upsertEnv("MAPBOX_PUBLIC_TOKEN", publicToken);
  upsertEnv("VITE_MAPBOX_TOKEN", publicToken);
  console.log("Saved MAPBOX_PUBLIC_TOKEN and VITE_MAPBOX_TOKEN to .env");
  console.log("Run: npm run deploy:full");
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
