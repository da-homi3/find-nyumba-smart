/**
 * Wraps the built Cloudflare worker with scheduled handlers for cron jobs.
 * Run after `npm run build` (invoked from sync-wrangler-env.mjs).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const serverDir = join(root, "dist", "server");
const wranglerConfig = join(serverDir, "wrangler.json");
const workerWrapper = join(serverDir, "worker.mjs");

/** Cloudflare cron: day-of-week is 1–7 (1 = Sunday) or SUN–SAT — not 0. */
const CRON_SCHEDULES = ["0 6 * * *", "0 8 * * 1", "0 7 1 * *"];

const WRAPPER_SOURCE = `import app from "./index.mjs";

const CRON_PATHS = {
  "0 6 * * *": "/api/cron/daily",
  "0 8 * * 1": "/api/cron/weekly",
  "0 7 1 * *": "/api/cron/monthly",
};

async function runCron(base, secret, path) {
  const res = await fetch(\`\${base.replace(/\\/$/, "")}\${path}\`, {
    method: "POST",
    headers: { Authorization: \`Bearer \${secret}\` },
  });
  if (!res.ok) {
    console.error("[cron]", path, "failed:", res.status, await res.text());
  }
}

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(event, env, _ctx) {
    const secret = env.CRON_SECRET;
    const base = env.PUBLIC_APP_URL || env.SITE_URL;
    if (!secret || !base) {
      console.warn("[cron] CRON_SECRET or site URL not configured — skipping");
      return;
    }
    const path = CRON_PATHS[event.cron] ?? "/api/cron/daily";
    await runCron(base, secret, path);
  },
};
`;

export function patchWorkerCron() {
  if (!existsSync(wranglerConfig)) {
    console.warn("Skip cron wrapper — run npm run build first.");
    return;
  }

  writeFileSync(workerWrapper, WRAPPER_SOURCE, "utf8");

  const cfg = JSON.parse(readFileSync(wranglerConfig, "utf8"));
  cfg.main = "worker.mjs";
  cfg.triggers = { crons: CRON_SCHEDULES };
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
  console.log(`Patched worker cron (${CRON_SCHEDULES.join(", ")}) → worker.mjs`);
}
