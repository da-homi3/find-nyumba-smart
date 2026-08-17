#!/usr/bin/env node
/**
 * Records property manager tutorial footage:
 *  - Live nyumbasearch.com public pages (Playwright video)
 *  - Local capture-studio.html scenes (dashboard + upload wizard)
 *
 * Output: docs/video-tutorial/footage/*.webm
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "video-tutorial", "footage");
const STUDIO = path.join(ROOT, "docs", "video-tutorial", "capture-studio.html");
const BASE = process.env.DEMO_BASE_URL ?? "https://nyumbasearch.com";

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function serveStudio(port = 8765) {
  const html = await readFile(STUDIO, "utf8");
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function recordClip(browser, name, recordFn, viewport = { width: 1920, height: 1080 }) {
  const outPath = path.join(OUT, `${name}.webm`);
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: OUT, size: viewport },
  });
  const page = await context.newPage();
  console.log(`  → recording ${name}`);
  await recordFn(page);
  await pause(800);
  const video = page.video();
  await context.close();
  if (video) {
    const tmp = await video.path();
    const { rename } = await import("node:fs/promises");
    await rename(tmp, outPath);
  }
  return outPath;
}

async function scrollToManagerPlans(page) {
  await page.evaluate(() => {
    const headings = [...document.querySelectorAll("h2,h3,h4")];
    const el = headings.find((h) => /manager|property manager/i.test(h.textContent ?? ""));
    el?.scrollIntoView({ behavior: "instant", block: "start" });
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const studio = await serveStudio();

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.DEMO_BROWSER_CHANNEL ?? "chrome",
  });

  console.log(`Recording tutorial footage → ${OUT}`);

  await recordClip(browser, "01-intro-manager-portal", async (page) => {
    await page.goto(`${BASE}/manager`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pause(3500);
    await page.mouse.wheel(0, 200);
    await pause(2000);
  });

  await recordClip(browser, "02-signup-flow", async (page) => {
    await page.goto(
      `${BASE}/auth?signupFor=manager&mode=signup&redirect=/manager/dashboard`,
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );
    await pause(4500);
    await page.goto(
      `${BASE}/auth?signupFor=manager&mode=signin&redirect=/manager/dashboard`,
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );
    await pause(3500);
  });

  await recordClip(browser, "03-pricing-manager", async (page) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pause(2000);
    await scrollToManagerPlans(page);
    await pause(4500);
  });

  const scenes = [
    { scene: "dashboard", dur: 75000 },
    { scene: "nav", dur: 50000 },
    { scene: "wizard-details", dur: 55000 },
    { scene: "wizard-media", dur: 50000 },
    { scene: "wizard-location", dur: 45000 },
    { scene: "wizard-review", dur: 45000 },
    { scene: "pm-portfolio", dur: 50000 },
    { scene: "team-close", dur: 45000 },
  ];

  let idx = 4;
  for (const { scene, dur } of scenes) {
    const num = String(idx).padStart(2, "0");
    await recordClip(browser, `${num}-studio-${scene}`, async (page) => {
      await page.goto(`${studio.url}?scene=${scene}`, { waitUntil: "domcontentloaded" });
      await pause(1200);
      await page.evaluate((s) => window.__tutorialGo?.(s), scene);
      await pause(dur);
    });
    idx++;
  }

  await browser.close();
  await studio.close();
  console.log("\nFootage complete.");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
