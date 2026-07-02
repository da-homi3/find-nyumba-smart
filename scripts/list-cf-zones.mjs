import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const candidates = [
  join(homedir(), ".config", ".wrangler", "config", "default.toml"),
  join(process.env.APPDATA ?? "", "xdg.config", ".wrangler", "config", "default.toml"),
];
const configPath = candidates.find((p) => existsSync(p));
if (!configPath) {
  console.error("No wrangler config — run: npx wrangler login");
  process.exit(1);
}
const toml = readFileSync(configPath, "utf8");
const token = toml.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
if (!token) {
  console.error("No wrangler oauth token — run: npx wrangler login");
  process.exit(1);
}

const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
if (!data.success) {
  console.error("API error:", JSON.stringify(data.errors, null, 2));
  process.exit(1);
}
for (const z of data.result ?? []) {
  console.log(`${z.name}\t${z.id}\t${z.status}`);
}
