/**
 * Sign up / sign in to Mapbox and extract default public token.
 * Requires MAPBOX_SIGNUP_EMAIL and MAPBOX_SIGNUP_PASSWORD in env (or shell).
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const PK_TOKEN_PATTERN = /pk\.ey[A-Za-z0-9._-]+/;

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

function resolveCredentials() {
  const email = process.env.MAPBOX_SIGNUP_EMAIL?.trim();
  const password = process.env.MAPBOX_SIGNUP_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      "Set MAPBOX_SIGNUP_EMAIL and MAPBOX_SIGNUP_PASSWORD before running setup-mapbox-auto.mjs",
    );
  }
  return { email, password };
}

function findTokenInHtml(html) {
  return PK_TOKEN_PATTERN.exec(html)?.[0] ?? null;
}

async function extractToken(page) {
  await page.goto("https://account.mapbox.com/access-tokens/", {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });

  if (page.url().includes("/auth/")) return null;

  const html = await page.content();
  return findTokenInHtml(html);
}

async function main() {
  const { email, password } = resolveCredentials();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("https://account.mapbox.com/auth/signin/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await page.locator('input[type="email"], input[name="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(4000);

    let token = await extractToken(page);

    if (!token) {
      console.log("Sign-in failed or needs verification — trying signup…");
      await page.goto("https://account.mapbox.com/auth/signup/", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      await page.locator('input[type="email"], input[name="email"]').first().fill(email);
      const pwFields = page.locator('input[type="password"]');
      const pwCount = await pwFields.count();
      for (let i = 0; i < pwCount; i += 1) {
        await pwFields.nth(i).fill(password);
      }

      const checkboxes = page.locator('input[type="checkbox"]');
      if (await checkboxes.count()) {
        await checkboxes
          .first()
          .check({ force: true })
          .catch(() => {});
      }

      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
      token = await extractToken(page);
    }

    if (!token) {
      throw new Error(
        `Could not obtain Mapbox token automatically. Email verification may be required for ${email}.`,
      );
    }

    upsertEnv("MAPBOX_PUBLIC_TOKEN", token);
    upsertEnv("VITE_MAPBOX_TOKEN", token);
    console.log("Mapbox token saved to .env");
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
