/**
 * Attach nyumbasearch.com custom domains to the nyumba-search Worker.
 * Requires the zone to exist in your Cloudflare account (Dashboard → Add site).
 *
 * Usage: npm run deploy:domain
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { patchWorkerCron } from "./patch-worker-cron.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wranglerConfig = join(root, "dist", "server", "wrangler.json");

const CUSTOM_DOMAINS = ["nyumbasearch.com", "www.nyumbasearch.com"];

function patchConfig() {
  if (!existsSync(wranglerConfig)) {
    console.error("Run npm run build first.");
    process.exit(1);
  }
  const cfg = JSON.parse(readFileSync(wranglerConfig, "utf8"));
  cfg.workers_dev = true;
  cfg.routes = CUSTOM_DOMAINS.map((hostname) => ({
    pattern: hostname,
    custom_domain: true,
  }));
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
  patchWorkerCron();
}

patchConfig();
console.log("Deploying with custom domains…");
try {
  execSync(`npx wrangler deploy --config "${wranglerConfig}"`, {
    stdio: "inherit",
    cwd: root,
  });
  console.log("\n✓ Deploy complete. Test https://nyumbasearch.com");
} catch {
  console.error(`
✗ Custom domain attach failed.

The domain nyumbasearch.com uses Cloudflare nameservers but is NOT in your
Cloudflare account (kevinbuluma9@gmail.com). To fix:

1. Open https://dash.cloudflare.com → Add a site → nyumbasearch.com
2. If it is already on Cloudflare under another account, transfer the zone
   or log in with that account and run deploy there.
3. Re-run: npm run deploy:domain

Until then the app stays live at:
  https://nyumba-search.kevinbuluma9-7ff.workers.dev (fallback)
  Production: https://nyumbasearch.com
`);
  process.exit(1);
}
