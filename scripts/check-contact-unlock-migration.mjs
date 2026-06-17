import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

for (const [table, col] of [
  ["contact_unlocks", "id"],
  ["service_providers", "id"],
  ["profiles", "trial_unlocks_remaining"],
]) {
  const r = await admin.from(table).select(col).limit(1);
  console.log(table, r.error?.message ?? "ok", r.data);
}
