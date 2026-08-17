#!/usr/bin/env node
/**
 * Records the property manager tutorial from live nyumbasearch.com.
 * Signs in OFF-CAMERA when TUTORIAL_EMAIL / TUTORIAL_PASSWORD are set.
 * Emails and password fields are masked. Credentials are never committed.
 */
import { chromium } from "playwright";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "video-tutorial", "footage");
const SESSION = path.join(ROOT, "docs", "video-tutorial", ".session.json");
const BASE = process.env.DEMO_BASE_URL ?? "https://nyumbasearch.com";
const EMAIL = process.env.TUTORIAL_EMAIL ?? "";
const PASSWORD = process.env.TUTORIAL_PASSWORD ?? "";

const PRIVACY_CSS = `
input[type="email"], input[type="password"] {
  filter: blur(14px) !important;
  -webkit-text-security: disc !important;
}
a[href^="mailto:"], a[href^="tel:"] {
  filter: blur(10px) !important;
}
`;

const PRIVACY_INIT = `(() => {
  const redact = () => {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const t = n.textContent || "";
      const next = t
        .replace(/[\\w.+-]+@[\\w.-]+\\.\\w+/g, "••••••••")
        .replace(/\\+?254[\\d\\s]{8,}/g, "••••••••")
        .replace(/0[17]\\d{8}/g, "••••••••");
      if (next !== t) n.textContent = next;
    }
  };
  const start = () => {
    redact();
    setInterval(redact, 400);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();`;

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function setReactInput(locator, value) {
  await locator.click();
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function dismissOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.getByRole("button", { name: /essential only|accept all/i }).first().click({ timeout: 1500 }).catch(() => {});
  await page.getByRole("button", { name: /skip tour/i }).click({ timeout: 1500 }).catch(() => {});
  await page.getByText(/skip tour/i).first().click({ timeout: 1200 }).catch(() => {});
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

async function maskAccountDetails(page) {
  await page.addStyleTag({ content: PRIVACY_CSS }).catch(() => {});
  await page.evaluate(() => {
    const redact = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        const t = n.textContent || "";
        const next = t
          .replace(/[\w.+-]+@[\w.-]+\.\w+/g, "••••••••")
          .replace(/\+?254[\d\s]{8,}/g, "••••••••")
          .replace(/0[17]\d[\d\s]{7,}/g, "••••••••");
        if (next !== t) n.textContent = next;
      }
    };
    redact(document.body);
    if (!window.__nsPiiObserver) {
      window.__nsPiiObserver = new MutationObserver(() => redact(document.body));
      window.__nsPiiObserver.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }
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

async function gotoLive(page, pathOrUrl) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pause(1600);
  await dismissOverlays(page);
  await maskAccountDetails(page);
  await pause(400);
}

async function signInOffCamera(browser) {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Set TUTORIAL_EMAIL and TUTORIAL_PASSWORD in the environment.");
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("ns_auth_gate_dismissed", "1");
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/auth?signupFor=manager&mode=signin&redirect=/manager/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await pause(1800);
  await dismissOverlays(page);
  const form = page.locator("form").filter({ has: page.locator('input[type="email"]') }).first();
  await setReactInput(form.locator('input[type="email"]'), EMAIL);
  await setReactInput(form.locator('input[type="password"]').first(), PASSWORD);
  const tokenPromise = page.waitForResponse((r) => r.url().includes("/auth/v1/token"), { timeout: 25000 });
  await page.locator("button[type='submit'].bg-gradient-emerald").click();
  const token = await tokenPromise.catch(() => null);
  if (!token || token.status() >= 400) {
    await context.close();
    throw new Error("Sign-in was rejected by nyumbasearch.com.");
  }
  await page.waitForURL(/\/manager\//, { timeout: 25000 });
  await pause(2000);
  await context.storageState({ path: SESSION });
  await context.close();
  console.log("  signed in off-camera");
}

async function recordClip(browser, name, recordFn) {
  const only = process.env.TUTORIAL_ONLY;
  const skip = (process.env.TUTORIAL_SKIP ?? "").split(",").filter(Boolean);
  if (only && !name.includes(only)) {
    console.log(`  skip ${name}`);
    return null;
  }
  if (skip.some((s) => name.includes(s))) {
    console.log(`  skip ${name}`);
    return null;
  }
  const outPath = path.join(OUT, `${name}.webm`);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    storageState: SESSION,
  });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("ns_auth_gate_dismissed", "1");
    } catch {
      /* ignore */
    }
  });
  await context.addInitScript(PRIVACY_INIT);
  const page = await context.newPage();
  console.log(`  → recording ${name}`);
  await recordFn(page);
  await pause(500);
  const video = page.video();
  await context.close();
  if (video) {
    const tmp = await video.path();
    const { rename } = await import("node:fs/promises");
    await rename(tmp, outPath);
  }
  return outPath;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.DEMO_BROWSER_CHANNEL ?? "chrome",
  });

  console.log(`Recording LIVE dashboard footage from ${BASE}`);
  await signInOffCamera(browser);

  if (!process.env.TUTORIAL_ONLY && !process.env.TUTORIAL_SKIP) {
    const existing = await readdir(OUT);
    for (const f of existing) {
      if (f.endsWith(".webm") || f === "concat.txt") await unlink(path.join(OUT, f)).catch(() => {});
    }
  }

  await recordClip(browser, "01-homepage", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/");
    await page.locator("h1").first().waitFor({ timeout: 20000 }).catch(() => {});
    await pause(2000);
    await slowScroll(page, 600, 5);
    await holdUntil(t0, 14000);
  });

  await recordClip(browser, "02-dashboard", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager/dashboard");
    await page.locator("h1").first().waitFor({ timeout: 20000 }).catch(() => {});
    await pause(2500);
    await slowScroll(page, 1600, 12);
    await pause(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(1200);
    const add = page.getByRole("link", { name: /add property/i }).first();
    if (await add.count()) await add.hover().catch(() => {});
    await holdUntil(t0, 30000);
  });

  await recordClip(browser, "03-properties", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager/properties");
    await pause(2500);
    await slowScroll(page, 800, 6);
    await holdUntil(t0, 18000);
  });

  await recordClip(browser, "04-add-property", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager/properties/new");
    await pause(2500);
    const type = page.getByLabel(/property type/i).first();
    if (await type.count()) {
      await type.selectOption({ label: /apartment/i }).catch(() => type.click());
      await pause(600);
    }
    const beds = page.getByLabel(/bedroom/i).first();
    if (await beds.count()) {
      const tag = await beds.evaluate((el) => el.tagName);
      if (tag === "SELECT") await beds.selectOption({ index: 2 }).catch(() => {});
      else await beds.fill("2").catch(() => {});
      await pause(400);
    }
    const rent = page.getByLabel(/rent|price|amount/i).first();
    if (await rent.count()) {
      await rent.fill("45000").catch(() => {});
      await pause(400);
    }
    const title = page.getByLabel(/^title$/i).first();
    if (await title.count()) {
      await title.fill("Bright 2BR with parking — Westlands");
      await pause(600);
    }
    await slowScroll(page, 700, 6);
    const photosTab = page.getByRole("button", { name: /photos|media/i }).first();
    if (await photosTab.count()) {
      await photosTab.click().catch(() => {});
      await pause(1800);
    }
    const mapTab = page.getByRole("button", { name: /map|location|pin/i }).first();
    if (await mapTab.count()) {
      await mapTab.click().catch(() => {});
      await pause(1800);
    }
    const reviewTab = page.getByRole("button", { name: /review/i }).first();
    if (await reviewTab.count()) {
      await reviewTab.click().catch(() => {});
      await pause(1800);
    }
    await holdUntil(t0, 32000);
  });

  await recordClip(browser, "05-manage-rent", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager/manage");
    await pause(2500);
    await slowScroll(page, 800, 6);
    await holdUntil(t0, 18000);
  });

  await recordClip(browser, "06-team", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager/team");
    await pause(4000);
    await maskAccountDetails(page);
    await pause(800);
    await slowScroll(page, 400, 3);
    await holdUntil(t0, 14000);
  });

  await recordClip(browser, "07-analytics", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager/analytics");
    await pause(2500);
    await slowScroll(page, 600, 5);
    await holdUntil(t0, 14000);
  });

  await recordClip(browser, "08-cta", async (page) => {
    const t0 = Date.now();
    await gotoLive(page, "/manager/dashboard");
    await pause(2500);
    await holdUntil(t0, 12000);
  });

  await browser.close();
  await unlink(SESSION).catch(() => {});
  console.log("\nDashboard footage complete. Session removed.");
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
