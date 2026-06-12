/**
 * Screen-records a full NyumbaSearch walkthrough (public + portal surfaces).
 * Output: demos/nyumbasearch-full-walkthrough.webm
 */
import { chromium } from "playwright";
import { mkdir, rename, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_BASE_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";
const OUT_DIR = path.join(__dirname, "..", "demos");
const VIDEO_DIR = path.join(OUT_DIR, "recordings");
const FINAL = path.join(OUT_DIR, "nyumbasearch-full-walkthrough.webm");

const TOUR = [
  { label: "Landing", path: "/", scroll: true, wait: 4000 },
  { label: "Tenant search", path: "/tenant", scroll: true, wait: 5000 },
  { label: "Map", path: "/tenant/map", scroll: false, wait: 5000 },
  { label: "Pricing", path: "/pricing", scroll: true, wait: 3500 },
  { label: "About", path: "/about", scroll: true, wait: 3500 },
  { label: "Contact", path: "/contact", scroll: false, wait: 3000 },
  { label: "Auth", path: "/auth", scroll: false, wait: 3500 },
  { label: "Landlord portal", path: "/landlord", scroll: true, wait: 4000 },
  { label: "Agency portal", path: "/agency", scroll: false, wait: 3500 },
  { label: "Caretaker", path: "/caretaker", scroll: false, wait: 3000 },
  { label: "Settings", path: "/settings", scroll: false, wait: 2500 },
  { label: "Manager", path: "/manager", scroll: false, wait: 3000 },
];

async function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function smoothScroll(page) {
  await page.evaluate(async () => {
    const step = Math.max(180, Math.floor(window.innerHeight * 0.45));
    const max = Math.min(document.body.scrollHeight, 3600);
    for (let y = 0; y < max; y += step) {
      window.scrollTo({ top: y, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 650));
    }
    await new Promise((r) => setTimeout(r, 800));
    window.scrollTo({ top: 0, behavior: "smooth" });
    await new Promise((r) => setTimeout(r, 600));
  });
}

async function exploreProperty(page) {
  await page.goto(`${BASE}/tenant`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await pause(2500);

  const card = page.locator('a[href*="/tenant/property/"]').first();
  if ((await card.count()) === 0) {
    console.log("    (no listings for property detail)");
    return;
  }

  await card.scrollIntoViewIfNeeded();
  await pause(800);
  await card.click();
  await page.waitForURL(/\/tenant\/property\//, { timeout: 20000 });
  await pause(3000);
  await smoothScroll(page);
  await pause(2000);

  const bookBtn = page.getByRole("button", { name: /book viewing|schedule/i }).first();
  if ((await bookBtn.count()) > 0) {
    await bookBtn.click();
    await pause(2000);
    await page.keyboard.press("Escape");
    await pause(1000);
  }
}

async function main() {
  await mkdir(VIDEO_DIR, { recursive: true });
  for (const f of await readdir(VIDEO_DIR).catch(() => [])) {
    if (f.endsWith(".webm")) await unlink(path.join(VIDEO_DIR, f)).catch(() => {});
  }

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.DEMO_BROWSER_CHANNEL ?? "chrome",
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
    colorScheme: "light",
  });

  const page = await context.newPage();
  console.log(`Recording walkthrough: ${BASE}`);

  for (const stop of TOUR) {
    console.log(`  → ${stop.label}`);
    await page.goto(`${BASE}${stop.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await pause(stop.wait);
    if (stop.scroll) await smoothScroll(page);
    await pause(1200);
  }

  console.log("  → Property detail");
  await exploreProperty(page);

  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) throw new Error("No video captured");

  const raw = await video.path();
  await rename(raw, FINAL);
  const { stat } = await import("node:fs/promises");
  const sizeMb = ((await stat(FINAL)).size / (1024 * 1024)).toFixed(1);
  console.log(`\nDone: ${FINAL} (${sizeMb} MB)`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
