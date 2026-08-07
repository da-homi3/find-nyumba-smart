/**
 * Verify the profiles RLS rules from the perspective of real signed-in users, by
 * impersonating the `authenticated` role with a spoofed JWT claim inside a rolled-back
 * transaction. Read-only: every probe ends in ROLLBACK.
 *
 * Usage: node scripts/verify-profile-rls.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
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

const env = loadEnv();

async function sql(query) {
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
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 800)}`);
  return JSON.parse(body);
}

/** Run a SELECT as `authenticated` with auth.uid() = userId, then roll back. */
function asUser(userId, select) {
  return sql(`
    BEGIN;
    SELECT set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);
    SET LOCAL ROLE authenticated;
    ${select};
    ROLLBACK;
  `);
}

/** The Management API returns rows from the last row-producing statement in the batch. */
function num(rows) {
  return rows?.[0]?.n;
}

let failures = 0;
function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) failures += 1;
  console.log(`  ${pass ? "ok  " : "FAIL"}  ${label} (got ${actual}, expected ${expected})`);
}

async function main() {
  const total = (await sql(`SELECT count(*)::int AS n FROM public.profiles;`))[0].n;
  console.log(`profiles rows in table: ${total}\n`);

  // A genuine inquiry counterparty pair.
  const pair = await sql(`
    SELECT i.tenant_id::text AS tenant, i.landlord_id::text AS landlord
    FROM public.inquiries i
    WHERE i.tenant_id IS NOT NULL AND i.landlord_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = i.tenant_id)
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = i.landlord_id)
    LIMIT 1;
  `);

  // Someone with no relationship to that tenant at all.
  let stranger = null;
  if (pair.length > 0) {
    const s = await sql(`
      SELECT p.id::text AS id FROM public.profiles p
      WHERE p.id <> '${pair[0].tenant}' AND p.id <> '${pair[0].landlord}'
        AND NOT EXISTS (
          SELECT 1 FROM public.inquiries i
          WHERE (i.tenant_id = '${pair[0].tenant}' AND i.landlord_id = p.id)
             OR (i.landlord_id = '${pair[0].tenant}' AND i.tenant_id = p.id))
        AND NOT EXISTS (
          SELECT 1 FROM public.viewings v
          WHERE (v.tenant_id = '${pair[0].tenant}' AND v.landlord_id = p.id)
             OR (v.landlord_id = '${pair[0].tenant}' AND v.tenant_id = p.id))
      LIMIT 1;
    `);
    stranger = s[0]?.id ?? null;
  }

  if (pair.length === 0) {
    console.log("No inquiry pair found — skipping counterparty checks.");
  } else {
    const { tenant, landlord } = pair[0];
    console.log(`Impersonating tenant ${tenant.slice(0, 8)}…`);

    const own = await asUser(
      tenant,
      `SELECT count(*)::int AS n FROM public.profiles WHERE id = '${tenant}'`,
    );
    check("can read OWN profile", num(own), 1);

    const cp = await asUser(
      tenant,
      `SELECT count(*)::int AS n FROM public.profiles WHERE id = '${landlord}'`,
    );
    check("can read inquiry COUNTERPARTY profile", num(cp), 1);

    if (stranger) {
      const st = await asUser(
        tenant,
        `SELECT count(*)::int AS n FROM public.profiles WHERE id = '${stranger}'`,
      );
      check("cannot read UNRELATED profile", num(st), 0);
    }

    const all = await asUser(tenant, `SELECT count(*)::int AS n FROM public.profiles`);
    const visible = num(all);
    console.log(`  info  tenant can see ${visible} of ${total} profiles`);
    if (visible >= total) {
      failures += 1;
      console.log("  FAIL  tenant can still see every profile");
    }
  }

  // The booking flow reads viewing participants' profiles on the user client, so the
  // viewings branch of the counterparty policy must resolve too.
  const vpair = await sql(`
    SELECT v.tenant_id::text AS tenant, v.landlord_id::text AS landlord
    FROM public.viewings v
    WHERE v.tenant_id IS NOT NULL AND v.landlord_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.tenant_id)
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.landlord_id)
    LIMIT 1;
  `);
  if (vpair.length === 0) {
    console.log("\nNo viewing pair found — skipping viewings-counterparty check.");
  } else {
    console.log(`\nImpersonating viewing tenant ${vpair[0].tenant.slice(0, 8)}…`);
    const seen = await asUser(
      vpair[0].tenant,
      `SELECT count(*)::int AS n FROM public.profiles WHERE id = '${vpair[0].landlord}'`,
    );
    check("can read VIEWING counterparty profile", num(seen), 1);
  }

  // Organization team lists must still resolve every member, including non-owners.
  const org = await sql(`
    SELECT a.user_id::text AS me, b.user_id::text AS teammate
    FROM public.organization_members a
    JOIN public.organization_members b
      ON b.organization_id = a.organization_id AND b.user_id <> a.user_id
    LIMIT 1;
  `);
  if (org.length === 0) {
    console.log("\nNo multi-member organization found — skipping team check.");
  } else {
    console.log(`\nImpersonating org member ${org[0].me.slice(0, 8)}…`);
    const mate = await asUser(
      org[0].me,
      `SELECT count(*)::int AS n FROM public.profiles WHERE id = '${org[0].teammate}'`,
    );
    check("can read TEAMMATE profile", num(mate), 1);
  }

  console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) failed.`);
  if (failures > 0) process.exit(1);
}

await main();
