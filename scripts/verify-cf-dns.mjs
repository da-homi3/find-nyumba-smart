import { readFileSync } from "node:fs";
import { join } from "node:path";

const ZONE_ID = "6718302c9ada2e3389e0fbc2a1d2eb09";
const envPath = join(process.cwd(), ".env");
const TOKEN_RE = /^CLOUDFLARE_DNS_API_TOKEN=(.+)$/m;
const tokenMatch = TOKEN_RE.exec(readFileSync(envPath, "utf8"));
const token = tokenMatch?.[1]?.trim().replace(/^["']|["']$/g, "");
const headers = { Authorization: `Bearer ${token}` };
const res = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?per_page=100`,
  { headers },
);
const data = await res.json();
const wanted = ["em2954", "s1._domainkey", "s2._domainkey", "_dmarc", "url7389", "109129355"];
for (const name of wanted) {
  const rec = data.result?.find((r) => r.name.startsWith(name + ".") || r.name === name);
  console.log(rec ? `OK  ${rec.type} ${rec.name} → ${rec.content}` : `MISSING ${name}`);
}
