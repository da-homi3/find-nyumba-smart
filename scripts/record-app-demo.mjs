/**
 * Captures a full-app walkthrough as screenshots + auto-play HTML demo.
 * Output:
 *   demos/screenshots/*.png
 *   demos/nyumbasearch-walkthrough.html  (open in browser — fullscreen for recording)
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_BASE_URL ?? "https://nyumbasearch.com";
const OUT_DIR = path.join(__dirname, "..", "demos");
const SHOT_DIR = path.join(OUT_DIR, "screenshots");

const PAGES = [
  { name: "01-landing", path: "/", scroll: true, caption: "Landing — verified Nairobi rentals" },
  { name: "02-tenant-search", path: "/tenant", scroll: true, caption: "Tenant search & filters" },
  { name: "03-map", path: "/tenant/map", scroll: false, caption: "Map-first discovery" },
  { name: "04-pricing", path: "/pricing", scroll: true, caption: "Landlord pricing plans" },
  { name: "05-about", path: "/about", scroll: true, caption: "About NyumbaSearch" },
  { name: "06-contact", path: "/contact", scroll: false, caption: "Contact & support" },
  { name: "07-auth", path: "/auth", scroll: false, caption: "Sign in / sign up" },
  { name: "08-landlord", path: "/landlord", scroll: true, caption: "Landlord portal" },
  { name: "09-agency", path: "/agency", scroll: false, caption: "Agency portal" },
  { name: "10-caretaker", path: "/caretaker", scroll: false, caption: "Caretaker PIN access" },
  { name: "11-settings", path: "/settings", scroll: false, caption: "Settings hub" },
  { name: "12-manager", path: "/manager", scroll: false, caption: "Property manager portal" },
];

async function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrollPage(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.5));
    const max = Math.min(document.body.scrollHeight, 2800);
    for (let y = 0; y < max; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}

async function capture(page, fileBase, caption) {
  const file = `${fileBase}.png`;
  const fullPath = path.join(SHOT_DIR, file);
  await page.screenshot({ path: fullPath, fullPage: false });
  return { file, caption };
}

async function tryPropertyDetail(page, shots) {
  await page.goto(`${BASE}/tenant`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pause(2000);
  const card = page.locator('a[href*="/tenant/property/"]').first();
  if ((await card.count()) === 0) return;
  await card.click();
  await page.waitForURL(/\/tenant\/property\//, { timeout: 15000 });
  await pause(2000);
  shots.push(await capture(page, "13-property-detail", "Property detail — book viewing, AI chat"));
  await scrollPage(page);
  await pause(500);
  shots.push(await capture(page, "14-property-detail-scroll", "Listing intelligence & reviews"));
}

function buildHtml(shots) {
  const slides = shots
    .map(
      (s, i) =>
        `    { file: "screenshots/${s.file}", caption: ${JSON.stringify(s.caption)}, dur: ${i < 2 ? 5000 : 4000} }`,
    )
    .join(",\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NyumbaSearch — Full App Walkthrough</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; color: #fff; font-family: system-ui, sans-serif; overflow: hidden; }
    #stage { position: relative; width: 100vw; height: 100vh; display: grid; place-items: center; }
    img { max-width: 100vw; max-height: 82vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
    #bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 16px 24px; background: linear-gradient(transparent, rgba(0,0,0,.85)); }
    #caption { font-size: 1.25rem; font-weight: 600; }
    #progress { margin-top: 8px; height: 4px; background: rgba(255,255,255,.2); border-radius: 2px; overflow: hidden; }
    #progress > div { height: 100%; background: #22c55e; width: 0%; transition: width .2s; }
    #meta { font-size: .85rem; opacity: .7; margin-top: 6px; }
    #logo { position: fixed; top: 20px; left: 24px; font-weight: 700; letter-spacing: -.02em; }
  </style>
</head>
<body>
  <div id="logo">NyumbaSearch · Product Walkthrough</div>
  <div id="stage"><img id="shot" alt="" /></div>
  <div id="bar">
    <div id="caption"></div>
    <div id="progress"><div id="fill"></div></div>
    <div id="meta">Press Space to pause · Arrow keys to step · F for fullscreen</div>
  </div>
  <script>
    const slides = [
${slides}
    ];
    let i = 0, paused = false, timer;
    const img = document.getElementById('shot');
    const cap = document.getElementById('caption');
    const fill = document.getElementById('fill');
    function show(n) {
      i = (n + slides.length) % slides.length;
      const s = slides[i];
      img.src = s.file;
      cap.textContent = s.caption;
      fill.style.width = ((i + 1) / slides.length * 100) + '%';
      clearTimeout(timer);
      if (!paused) timer = setTimeout(() => show(i + 1), s.dur);
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); paused = !paused; if (!paused) show(i); else clearTimeout(timer); }
      if (e.key === 'ArrowRight') { clearTimeout(timer); show(i + 1); }
      if (e.key === 'ArrowLeft') { clearTimeout(timer); show(i - 1); }
      if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.();
    });
    show(0);
  </script>
</body>
</html>`;
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.DEMO_BROWSER_CHANNEL ?? "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const shots = [];

  console.log(`Capturing demo against ${BASE}`);

  for (const section of PAGES) {
    console.log(`  → ${section.name}`);
    await page.goto(`${BASE}${section.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await pause(2000);
    if (section.scroll) await scrollPage(page);
    shots.push(await capture(page, section.name, section.caption));
  }

  console.log("  → Property detail (if available)");
  await tryPropertyDetail(page, shots);

  await browser.close();

  const htmlPath = path.join(OUT_DIR, "nyumbasearch-walkthrough.html");
  await writeFile(htmlPath, buildHtml(shots), "utf8");
  console.log(`\nScreenshots: ${SHOT_DIR}`);
  console.log(`Auto-play demo: ${htmlPath}`);
  console.log("Open the HTML file fullscreen and use Win+G (Xbox Game Bar) to record.");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
