/**
 * Verify key pages fit every common iOS & Android phone viewport (Playwright device presets).
 * Usage: node scripts/verify-responsive.mjs
 * Env: PUBLIC_APP_URL (default https://nyumbasearch.com)
 */
import { chromium, devices } from "playwright";

const BASE = process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com";

const TABLET_PATTERN = /iPad|Tab|Nexus 7|Nexus 10|PlayBook|Kindle/i;

/** All Playwright phone presets — iOS + Android, portrait only. */
function phoneDeviceNames() {
  return Object.entries(devices)
    .filter(([name, descriptor]) => {
      if (/landscape/i.test(name)) return false;
      if (TABLET_PATTERN.test(name)) return false;
      if (!descriptor.isMobile) return false;
      return /iPhone|Galaxy|Pixel|Nexus|Moto|BlackBerry|LG/i.test(name);
    })
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

const PHONE_DEVICES = phoneDeviceNames();

const PATHS = [
  "/",
  "/tenant",
  "/tenant/map",
  "/tenant/compare",
  "/tenant/saved",
  "/tenant/profile",
  "/auth",
  "/pricing",
  "/landlord",
  "/services",
  "/contact",
  "/about",
  "/privacy",
  "/settings",
];

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function platformFor(deviceName) {
  if (/iPhone/i.test(deviceName)) return "iOS";
  return "Android";
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const viewWidth = doc.clientWidth;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const overflowPx = Math.max(0, scrollWidth - viewWidth);
    const offenders = [];

    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.right > viewWidth + 2) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls =
          typeof el.className === "string" && el.className
            ? `.${el.className.split(/\s+/).slice(0, 2).join(".")}`
            : "";
        offenders.push(`${tag}${id}${cls} (+${Math.round(rect.right - viewWidth)}px)`);
        if (offenders.length >= 3) break;
      }
    }

    return { viewWidth, scrollWidth, overflowPx, offenders };
  });
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;

  const byPlatform = { iOS: { pass: 0, fail: 0 }, Android: { pass: 0, fail: 0 } };
  for (const result of results) {
    const platform = result.name.startsWith("iOS ") ? "iOS" : "Android";
    if (result.ok) byPlatform[platform].pass += 1;
    else byPlatform[platform].fail += 1;
  }

  const uniqueDevices = new Set(
    results.map((r) => {
      const match = r.name.match(/^(iOS|Android) (.+?) \(\d+px\)/);
      return match ? `${match[1]} ${match[2]}` : r.name;
    }),
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESPONSIVE SUMMARY — ${passed}/${total} checks passed`);
  console.log(`Devices tested: ${uniqueDevices.size} phones (${PHONE_DEVICES.length} presets)`);
  console.log(`Pages per device: ${PATHS.length}`);
  console.log(`iOS checks:     ${byPlatform.iOS.pass} passed, ${byPlatform.iOS.fail} failed`);
  console.log(
    `Android checks: ${byPlatform.Android.pass} passed, ${byPlatform.Android.fail} failed`,
  );
  console.log(`${"=".repeat(60)}\n`);

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error("Failures:");
    for (const f of failures) {
      console.error(`  • ${f.name}: ${f.detail}`);
    }
    console.error("");
  }
}

async function main() {
  const iosCount = PHONE_DEVICES.filter((n) => platformFor(n) === "iOS").length;
  const androidCount = PHONE_DEVICES.filter((n) => platformFor(n) === "Android").length;

  console.log(`\nNyumbaSearch mobile responsive audit → ${BASE}`);
  console.log(`iOS phones: ${iosCount} · Android phones: ${androidCount}`);
  console.log(
    `Total: ${PHONE_DEVICES.length} devices × ${PATHS.length} pages = ${PHONE_DEVICES.length * PATHS.length} checks\n`,
  );

  const browser = await chromium.launch({ headless: true });

  for (const deviceName of PHONE_DEVICES) {
    const descriptor = devices[deviceName];
    const platform = platformFor(deviceName);
    const width = descriptor.viewport.width;

    const context = await browser.newContext({
      ...descriptor,
      locale: "en-KE",
    });
    const page = await context.newPage();

    for (const path of PATHS) {
      const label = `${platform} ${deviceName} (${width}px) ${path}`;
      try {
        const response = await page.goto(`${BASE}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await page.waitForTimeout(600);

        if (!response || response.status() >= 400) {
          fail(label, `HTTP ${response?.status() ?? "no response"}`);
          continue;
        }

        const { overflowPx, offenders } = await measureOverflow(page);
        if (overflowPx <= 2) {
          pass(label, "fits viewport");
        } else {
          fail(label, `${overflowPx}px overflow — ${offenders.join(", ") || "unknown"}`);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        fail(label, detail);
      }
    }

    await context.close();
  }

  await browser.close();
  printSummary();

  const passed = results.filter((r) => r.ok).length;
  if (passed < results.length) {
    process.exit(1);
  }

  console.log("All iOS and Android phone viewports fit without horizontal overflow.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
