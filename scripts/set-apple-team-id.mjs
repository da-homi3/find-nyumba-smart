/**
 * Set APPLE_TEAM_ID in find-nyumba-smart/.env for AASA Universal Links.
 * Usage: node scripts/set-apple-team-id.mjs <TEAM_ID>
 * Then: npm run deploy
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env");

const teamId = (process.argv[2] ?? "").trim().toUpperCase();
if (!/^[A-Z0-9]{10}$/.test(teamId)) {
  console.error(
    "Usage: node scripts/set-apple-team-id.mjs <10-char Team ID>\n" +
      "Find it: https://developer.apple.com/account → Membership details → Team ID\n" +
      "Or Xcode → Settings → Accounts → Team",
  );
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

let text = readFileSync(envPath, "utf8");
if (/^APPLE_TEAM_ID=/m.test(text)) {
  text = text.replace(/^APPLE_TEAM_ID=.*$/m, `APPLE_TEAM_ID=${teamId}`);
} else {
  text = `${text.trimEnd()}\n\n# iOS Universal Links (AASA appID prefix)\nAPPLE_TEAM_ID=${teamId}\n`;
}
writeFileSync(envPath, text);
console.log(`Wrote APPLE_TEAM_ID=${teamId} to .env`);
console.log("Next: npm run deploy  (sync-wrangler will publish the var)");
console.log("Verify: curl -s https://nyumbasearch.com/.well-known/apple-app-site-association");
console.log(`Expect appID: ${teamId}.ke.co.nyumbasearch.app`);
