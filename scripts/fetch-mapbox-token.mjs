/**
 * Fetch Mapbox default public token from the dashboard (Playwright) or reuse .env.
 *
 * Usage:
 *   node scripts/fetch-mapbox-token.mjs
 *   node scripts/fetch-mapbox-token.mjs --force
 *   node scripts/fetch-mapbox-token.mjs --dry-run
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const TOKEN_KEYS = ["VITE_MAPBOX_TOKEN", "MAPBOX_PUBLIC_TOKEN"];
const PK_TOKEN_PATTERN = /pk\.ey[A-Za-z0-9._-]+/;
const MAPBOX_VERIFY_URL = "https://api.mapbox.com/styles/v1/mapbox/dark-v11";
const MAPBOX_TOKENS_URL = "https://account.mapbox.com/access-tokens/";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const dryRun = args.has("--dry-run");

function chromeUserDataDir() {
  if (process.platform === "win32") {
    return join(homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Google", "Chrome");
  }
  return join(homedir(), ".config", "google-chrome");
}

function parseEnvFile(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function readExistingToken() {
  if (!existsSync(envPath)) return null;
  const env = parseEnvFile(readFileSync(envPath, "utf8"));
  for (const key of TOKEN_KEYS) {
    const token = env[key]?.trim();
    if (token?.startsWith("pk.")) return token;
  }
  return null;
}

function upsertEnvTokens(token) {
  const original = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const env = parseEnvFile(original);
  env.MAPBOX_PUBLIC_TOKEN = token;
  env.VITE_MAPBOX_TOKEN = token;

  const lines = original.split("\n");
  const seen = new Set();
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([^#=]+)=/);
    if (match && TOKEN_KEYS.includes(match[1].trim())) {
      const key = match[1].trim();
      out.push(`${key}=${token}`);
      seen.add(key);
      continue;
    }
    out.push(line);
  }

  for (const key of TOKEN_KEYS) {
    if (!seen.has(key)) out.push(`${key}=${token}`);
  }

  writeFileSync(envPath, out.join("\n").replace(/\n*$/, "\n"));
}

async function verifyMapboxToken(token) {
  try {
    const url = `${MAPBOX_VERIFY_URL}?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

function findTokenInHtml(body) {
  return PK_TOKEN_PATTERN.exec(body)?.[0] ?? "";
}

async function extractTokenFromPage(page) {
  const inputs = page.locator('input[type="text"], input[readonly], textarea');
  const count = await inputs.count();
  for (let i = 0; i < count; i += 1) {
    const val = await inputs
      .nth(i)
      .inputValue()
      .catch(() => "");
    if (val.startsWith("pk.ey")) return val.trim();
  }

  const codes = page.locator("code");
  const codeCount = await codes.count();
  for (let i = 0; i < codeCount; i += 1) {
    const text = (await codes.nth(i).textContent())?.trim() ?? "";
    if (text.startsWith("pk.ey")) return text;
  }

  const body = await page.content();
  return findTokenInHtml(body);
}

async function createBrowserContext() {
  const profileDir = chromeUserDataDir();
  if (existsSync(profileDir)) {
    try {
      console.log("Using Chrome profile for Mapbox SSO…");
      const context = await chromium.launchPersistentContext(profileDir, {
        headless: true,
        channel: "chrome",
        args: ["--profile-directory=Default"],
      });
      return { context, browser: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Chrome profile unavailable (${message}). Using ephemeral session…`);
    }
  } else {
    console.log("Chrome profile not found. Using ephemeral browser session…");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  return { context, browser };
}

async function fetchTokenFromDashboard() {
  const { context, browser } = await createBrowserContext();
  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(MAPBOX_TOKENS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    if (page.url().includes("/auth/")) {
      throw new Error(
        "Not logged into Mapbox. Sign in at https://account.mapbox.com/auth/signup then rerun, or set VITE_MAPBOX_TOKEN=pk.ey... in .env manually.",
      );
    }

    await page.waitForTimeout(1500);
    const token = await extractTokenFromPage(page);
    if (!token.startsWith("pk.")) {
      throw new Error("Could not extract a public token from the Mapbox access tokens page.");
    }
    return token;
  } finally {
    await context.close();
    if (browser) await browser.close();
  }
}

async function main() {
  const existing = readExistingToken();
  if (existing && !force) {
    const valid = await verifyMapboxToken(existing);
    if (valid) {
      console.log("Mapbox token already present in .env and verified.");
      return;
    }
    console.warn("Existing Mapbox token in .env failed verification — fetching a new one…");
  }

  const token = await fetchTokenFromDashboard();
  const valid = await verifyMapboxToken(token);
  if (!valid) {
    throw new Error("Fetched token failed Mapbox API verification.");
  }

  if (dryRun) {
    console.log(
      `Verified token: ${token.slice(0, 12)}…${token.slice(-6)} (dry run — .env not modified)`,
    );
    return;
  }

  upsertEnvTokens(token);
  console.log("Saved MAPBOX_PUBLIC_TOKEN and VITE_MAPBOX_TOKEN to .env");
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
