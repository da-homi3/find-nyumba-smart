/**
 * Apply organization team invite migration (pending role + RLS).
 * Usage: npm run db:migrate:org-team
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  for (const path of [join(root, ".env")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

const MIGRATION_SQL = readFileSync(
  join(root, "supabase", "migrations", "20260705010000_organization_team_invites.sql"),
  "utf8",
);

async function runManagementQuery(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  }
  return body;
}

async function probePendingRole(admin) {
  const fakeOrg = "00000000-0000-0000-0000-000000000099";
  const fakeUser = "00000000-0000-0000-0000-000000000098";
  const { error } = await admin.from("organization_members").insert({
    organization_id: fakeOrg,
    user_id: fakeUser,
    role: "pending",
  });
  if (!error) {
    await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", fakeOrg)
      .eq("user_id", fakeUser);
    return true;
  }
  if (error.message.includes("organization_members_role_check")) return false;
  // FK violation means constraint allows pending — good enough
  if (error.message.includes("foreign key") || error.message.includes("violates")) return true;
  return false;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;

  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  if (await probePendingRole(admin)) {
    console.log("✓ Organization team invite migration already applied (pending role allowed).");
    return;
  }

  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.\n");
    console.log("Paste this SQL in Supabase Dashboard → SQL Editor:\n");
    console.log(MIGRATION_SQL);
    process.exit(1);
  }

  console.log("Applying organization team invite migration…");
  await runManagementQuery(token, projectRef, MIGRATION_SQL);

  const rlsFix = readFileSync(
    join(root, "supabase", "migrations", "20260705011000_organization_members_rls_fix.sql"),
    "utf8",
  );
  await runManagementQuery(token, projectRef, rlsFix);

  if (await probePendingRole(admin)) {
    console.log("✓ Organization team invite migration applied.");
  } else {
    console.error("Migration ran but pending role still blocked — check SQL manually.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
