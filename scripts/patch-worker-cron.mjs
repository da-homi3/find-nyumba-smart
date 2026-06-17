/**
 * Wraps the built Cloudflare worker with a scheduled handler for subscription renewals.
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

const CRON_SCHEDULE = "0 6 * * *";

const WRAPPER_SOURCE = `import app from "./index.mjs";

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event, env, _ctx) {
    const secret = env.CRON_SECRET;
    const base = env.PUBLIC_APP_URL || env.SITE_URL;
    if (!secret || !base) {
      console.warn("[cron] CRON_SECRET or site URL not configured — skipping renewals");
      return;
    }
    const res = await fetch(\`\${base.replace(/\\/$/, "")}/api/cron/subscription-renewals\`, {
      method: "POST",
      headers: { Authorization: \`Bearer \${secret}\` },
    });
    if (!res.ok) {
      console.error("[cron] subscription-renewals failed:", res.status, await res.text());
    }
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
  cfg.triggers = { crons: [CRON_SCHEDULE] };
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
  console.log(`Patched worker cron (${CRON_SCHEDULE}) → worker.mjs`);
}
