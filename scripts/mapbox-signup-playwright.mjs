import { chromium } from "@playwright/test";
import { randomBytes } from "node:crypto";

function signupPassword() {
  if (process.env.MAPBOX_SIGNUP_PASSWORD?.trim()) {
    return process.env.MAPBOX_SIGNUP_PASSWORD.trim();
  }
  return `NyumbaMapbox!${randomBytes(4).toString("hex")}`;
}

async function main() {
  const email = process.env.MAPBOX_SIGNUP_EMAIL ?? "kevinbuluma9@gmail.com";
  const password = signupPassword();

  console.log(`Opening Mapbox signup for ${email}…`);
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://account.mapbox.com/auth/signup/", { waitUntil: "networkidle" });

  await page.fill('input[type="email"], input[name="email"]', email).catch(() => {});
  await page.fill('input[type="password"]', password).catch(() => {});

  const terms = page.locator('input[type="checkbox"]');
  if (await terms.count()) {
    await terms
      .first()
      .check({ force: true })
      .catch(() => {});
  }

  await page.click('button[type="submit"], button:has-text("Sign up")').catch(() => {});

  console.log(`
If signup succeeded, check email (${email}) to verify, then sign in at:
https://account.mapbox.com/access-tokens/

Copy the Default public token (pk.ey...) and run:
  node scripts/provision-mapbox.mjs

Or paste manually into .env:
  MAPBOX_PUBLIC_TOKEN=pk.ey...
  VITE_MAPBOX_TOKEN=pk.ey...

Temporary password (save if new account): ${password}
`);

  await page.waitForTimeout(120_000);
  await browser.close();
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
