/**
 * Dev-only seed: Anga Homes-style pilot fixture.
 * Never invents production metrics — only structure + zeroed KPIs.
 *
 * Usage: node scripts/seed-pilot-demo.mjs
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, and NODE_ENV !== production
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

async function main() {
  const env = loadEnv();
  if (env.NODE_ENV === "production" || env.CF_PAGES === "1") {
    console.error("Refusing to seed pilot demo against production.");
    process.exit(1);
  }
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const slug = "anga-homes-pilot";

  const { data: existing } = await admin
    .from("pilot_partnerships")
    .select("id")
    .eq("public_slug", slug)
    .maybeSingle();
  if (existing) {
    console.log("Pilot already exists:", existing.id);
    return;
  }

  let orgId = null;
  const { data: orgByName } = await admin
    .from("organizations")
    .select("id")
    .ilike("name", "Anga Homes%")
    .limit(1)
    .maybeSingle();
  if (orgByName) {
    orgId = orgByName.id;
  } else {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name: "Anga Homes (Pilot Demo)",
        slug: "anga-homes-pilot-demo",
        type: "agency",
        description: "Demo partner for local pilot partnership testing.",
        website: "https://example.com",
      })
      .select("id")
      .single();
    if (orgErr) throw orgErr;
    orgId = org.id;
  }

  const start = new Date();
  const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  const toDate = (d) => d.toISOString().slice(0, 10);

  const { data: pilot, error } = await admin
    .from("pilot_partnerships")
    .insert({
      organization_id: orgId,
      partner_name: "Anga Homes",
      partner_type: "REAL_ESTATE_AGENCY",
      status: "ACTIVE",
      public_slug: slug,
      show_partner_badge: true,
      pilot_start_date: toDate(start),
      pilot_end_date: toDate(end),
      objectives: ["Increase qualified enquiries", "Validate portfolio listing quality"],
      success_criteria: { min_enquiries: 20, min_views: 500 },
      notes: "Dev-only Anga Homes fixture — metrics start at zero.",
    })
    .select("id")
    .single();
  if (error) throw error;

  const kpis = [
    { metric: "property_views", target: 500, unit: "count" },
    { metric: "enquiries", target: 20, unit: "count" },
    { metric: "viewing_requests", target: 10, unit: "count" },
  ];
  await admin.from("pilot_kpis").insert(
    kpis.map((k) => ({
      pilot_id: pilot.id,
      metric: k.metric,
      target: k.target,
      actual: 0,
      unit: k.unit,
    })),
  );

  const { data: props } = await admin
    .from("properties")
    .select("id")
    .eq("is_published", true)
    .limit(3);
  if (props?.length) {
    await admin.from("pilot_properties").insert(
      props.map((p) => ({
        pilot_id: pilot.id,
        property_id: p.id,
        status: "LIVE",
        approved_at: new Date().toISOString(),
      })),
    );
  }

  console.log("Seeded Anga Homes pilot:", pilot.id, "→ /partners/" + slug);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
