import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const query = `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('alert_log', 'rate_limit_log', 'cookie_consent')
ORDER BY 1;
`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);

const body = await res.json();
if (!res.ok) {
  console.error("Query failed:", res.status, body);
  process.exit(1);
}

console.log("Tables:", body.map((r) => r.table_name).join(", "));
if (body.length !== 3) process.exit(1);
