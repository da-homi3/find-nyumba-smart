/**
 * Raise Supabase Storage global file size limit to 900 MiB.
 * Requires a paid Supabase plan (Free is hard-capped at 50 MiB).
 *
 * Usage (from find-nyumba-smart, with .env loaded):
 *   node --env-file=.env scripts/raise-storage-file-limit.mjs
 */
const LIMIT_BYTES = 900 * 1024 * 1024; // 943718400

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || process.env.VITE_SUPABASE_PROJECT_ID;
if (!token || !ref) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/storage`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ fileSizeLimit: LIMIT_BYTES }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, body);
  console.error(
    "\nIf you see Payment Required: upgrade the project to Pro at\n  https://supabase.com/dashboard/project/" +
      ref +
      "/settings/billing\nthen re-run this script.",
  );
  process.exit(1);
}
console.log("Updated storage config:", body);

const verify = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/storage`, {
  headers: { Authorization: `Bearer ${token}` },
});
const cfg = await verify.json();
console.log(
  "Current fileSizeLimit:",
  cfg.fileSizeLimit,
  `(${Math.round(cfg.fileSizeLimit / 1024 / 1024)} MiB)`,
);
