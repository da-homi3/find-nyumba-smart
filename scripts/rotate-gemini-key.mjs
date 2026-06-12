/**
 * Rotate Gemini API key: update .env, sync to Cloudflare, verify probe.
 *
 * Usage:
 *   node scripts/rotate-gemini-key.mjs <NEW_GEMINI_API_KEY>
 *   NEW_GEMINI_API_KEY=... node scripts/rotate-gemini-key.mjs
 *
 * Create a new key at https://aistudio.google.com/apikey then delete the old one.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

const newKey = process.argv[2]?.trim() || process.env.NEW_GEMINI_API_KEY?.trim();
if (!newKey) {
  console.error("Usage: node scripts/rotate-gemini-key.mjs <NEW_GEMINI_API_KEY>");
  console.error("Create a key at https://aistudio.google.com/apikey");
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error("Missing .env");
  process.exit(1);
}

let envText = readFileSync(envPath, "utf8");
const line = `GEMINI_API_KEY=${newKey}`;
if (/^GEMINI_API_KEY=/m.test(envText)) {
  envText = envText.replace(/^GEMINI_API_KEY=.*$/m, line);
} else {
  envText = `${envText.trimEnd()}\n${line}\n`;
}
writeFileSync(envPath, envText, "utf8");
console.log("✓ Updated .env GEMINI_API_KEY");

console.log("Testing new key…");
execSync("node scripts/test-gemini.mjs", {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, GEMINI_API_KEY: newKey },
});

console.log("Syncing to Cloudflare…");
execSync("node scripts/sync-wrangler-env.mjs", { stdio: "inherit", cwd: root });

const base = process.env.PUBLIC_APP_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";
console.log("Deploying worker (secrets already updated; deploy picks up code if needed)…");
execSync("npx wrangler deploy --config dist/server/wrangler.json", { stdio: "inherit", cwd: root });

const probe = await fetch(`${base}/api/ai/probe`, { signal: AbortSignal.timeout(60_000) });
const body = await probe.json();
console.log("Probe:", JSON.stringify(body));
if (!body.live || body.provider !== "gemini") {
  console.error("Probe did not confirm Gemini — check Cloudflare secrets.");
  process.exit(1);
}
console.log("\n✓ Gemini key rotated. Delete the old key in Google AI Studio.");
