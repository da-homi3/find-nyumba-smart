#!/usr/bin/env node
/**
 * Records the property manager tutorial exclusively from live nyumbasearch.com.
 * No mock capture studio. Authenticated dashboard routes redirect to /auth —
 * those clips show the real sign-in gate, then live marketplace listings that
 * result from uploading a property.
 *
 * Output: docs/video-tutorial/footage/*.webm
 */
import { chromium } from "playwright";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "video-tutorial", "footage");
const BASE = process.env.DEMO_BASE_URL ?? "https://nyumbasearch.com";

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dismissOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  const cookie = page.getByRole("button", { name: /essential only|accept all/i });
  if (await cookie.count()) {
    await cookie.first().click({ timeout: 2000 }).catch(() => {});
    await pause(400);
  }
  await page.evaluate(() => {
    document.querySelectorAll("dialog[open]").forEach((d) => {
      try {
        d.close();
      } catch {
        d.removeAttribute("open");
      }
    });
  });
}

async function holdUntil(startedAt, minMs) {
  const remain = minMs - (Date.now() - startedAt);
  if (remain > 0) await pause(remain);
}

async function slowScroll(page, pixels, steps = 8) {
  const step = Math.round(pixels / steps);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, step);
    await pause(280);
  }
}

async function recordClip(browser, name, recordFn, viewport = { width: 1920, height: 1080 }) {
  const only = process.env.TUTORIAL_ONLY;
  if (only && !name.includes(only)) {
    console.log(`  skip ${name}`);
    return null;
  }
  const outPath = path.join(OUT, `${name}.webm`);
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: OUT, size: viewport },
  });
  const page = await context.newPage();
  console.log(`  → recording ${name}`);
  await recordFn(page);
  await pause(600);
  const video = page.video();
  await context.close();
  if (video) {
    const tmp = await video.path();
    const { rename } = await import("node:fs/promises");
    await rename(tmp, outPath);
  }
  return outPath;
}

async function gotoLive(page, pathOrUrl) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pause(1800);
  await dismissOverlays(page);
  await pause(400);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const only = process.env.TUTORIAL_ONLY;
  if (!only) {
    const existing = await readdir(OUT);
    for (const f of existing) {
      if (f.endsWith(".webm") || f === "concat.txt") {
        await unlink(path.join(OUT, f)).catch(() => {});
      }
    }
  }

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.DEMO_BROWSER_CHANNEL ?? "chrome",
  });

  console.log(`Recording LIVE tutorial footage from ${BASE}`);

  await recordClip(browser, "01-homepage", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/");
    await page.locator("h1").first().waitFor({ timeout: 20000 }).catch(() => {});
    await pause(2500);
    await slowScroll(page, 900, 8);
    await pause(1200);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(1200);
    const list = page.getByRole("link", { name: /list property/i }).first();
    if (await list.count()) await list.hover().catch(() => {});
    await holdUntil(t0, 18000);
  });

  await recordClip(browser, "02-manager-portal", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager");
    await page.locator("h1").first().waitFor({ timeout: 15000 }).catch(() => {});
    await pause(2800);
    await slowScroll(page, 500, 5);
    await pause(1800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(1200);
    const cta = page.getByRole("link", { name: /create manager account/i }).first();
    if (await cta.count()) await cta.hover().catch(() => {});
    await holdUntil(t0, 24000);
  });

  await recordClip(browser, "03-create-account", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/auth?signupFor=manager&mode=signup&redirect=/manager/dashboard");
    await page.locator("h1").first().waitFor({ timeout: 15000 }).catch(() => {});
    await pause(1800);
    const name = page.getByLabel(/full name/i).first();
    if (await name.count()) {
      await name.click();
      await name.fill("Amina Ochieng");
      await pause(600);
    }
    const phone = page.getByLabel(/phone|m-pesa/i).first();
    if (await phone.count()) {
      await phone.click();
      await phone.fill("0714725598");
      await pause(600);
    }
    const org = page.getByLabel(/organization/i).first();
    if (await org.count()) {
      await org.click();
      await org.fill("Sunrise Property Management");
      await pause(600);
    }
    const email = page.getByLabel(/^email$/i).first();
    if (await email.count()) {
      await email.click();
      await email.fill("manager.demo@nyumbasearch.com");
      await pause(600);
    }
    await slowScroll(page, 400, 4);
    await holdUntil(t0, 22000);
  });

  await recordClip(browser, "04-sign-in", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/auth?signupFor=manager&mode=signin&redirect=/manager/dashboard");
    await pause(2000);
    const email = page.locator('input[type="email"]').first();
    if (await email.count()) {
      await email.click();
      await email.fill("approved.manager@nyumbasearch.com");
      await pause(900);
    }
    await holdUntil(t0, 18000);
  });

  await recordClip(browser, "05-pricing-manager", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/pricing");
    await pause(2000);
    await slowScroll(page, 1100, 9);
    await page.evaluate(() => {
      const headings = [...document.querySelectorAll("h1,h2,h3,h4,p,span,strong")];
      const el = headings.find((h) => /solo manager|property manager|management team/i.test(h.textContent ?? ""));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await pause(4000);
    await slowScroll(page, 400, 4);
    await holdUntil(t0, 22000);
  });

  await recordClip(browser, "06-tenant-listings", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/tenant");
    await pause(2800);
    await slowScroll(page, 1400, 10);
    await pause(1500);
    await holdUntil(t0, 22000);
  });

  await recordClip(browser, "07-property-detail", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/tenant");
    await pause(2000);
    const href = await page.locator('a[href*="/tenant/property/"]').first().getAttribute("href");
    if (href) {
      await gotoLive(page, href);
    } else {
      await gotoLive(page, "/tenant/property/6556288e-76ba-41ab-b9b4-1a64e9b3fd25");
    }
    await page.locator("h1").first().waitFor({ timeout: 15000 }).catch(() => {});
    await pause(2500);
    await slowScroll(page, 1400, 9);
    await pause(1200);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(1200);
    await holdUntil(t0, 20000);
  });

  await recordClip(browser, "08-map", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/tenant/map");
    await pause(3500);
    await page.mouse.move(960, 540);
    await pause(600);
    await page.mouse.wheel(0, -180);
    await pause(1200);
    await page.mouse.wheel(0, 180);
    await pause(1500);
    await holdUntil(t0, 14000);
  });

  await recordClip(browser, "09-landlord-portal", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/landlord");
    await pause(2500);
    await slowScroll(page, 600, 5);
    await pause(1500);
    await holdUntil(t0, 12000);
  });

  await recordClip(browser, "10-contact-cta", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/contact");
    await pause(2500);
    await gotoLive(page, "/manager");
    await pause(2500);
    await holdUntil(t0, 14000);
  });

  await browser.close();
  console.log("\nLive footage complete.");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
