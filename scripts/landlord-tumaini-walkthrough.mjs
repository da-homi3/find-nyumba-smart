/**
 * Landlord walkthrough — Tumaini Rongai listing + map pin for kevinbuluma9@gmail.com
 * Usage: node scripts/landlord-tumaini-walkthrough.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const BASE = process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com";
const KEVIN_EMAIL = "kevinbuluma9@gmail.com";
const TUMaini = { lat: -1.3912, lng: 36.7368 };

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  console.log(`\nLandlord Tumaini walkthrough → ${BASE}\n`);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const kevin = userList?.users?.find((u) => u.email === KEVIN_EMAIL);
  if (!kevin) {
    fail("Kevin account", "not found");
    process.exit(1);
  }
  pass("Kevin account", kevin.id);

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", kevin.id);
  const roleSet = new Set((roles ?? []).map((r) => r.role));
  if (roleSet.has("landlord")) pass("Landlord role", "assigned");
  else fail("Landlord role", "missing — sign up at /landlord");

  for (const path of [
    "/landlord/properties/new",
    "/landlord/properties",
    "/landlord/dashboard",
    "/api/mapbox-token",
  ]) {
    const res = await fetch(`${BASE}${path}`);
    if (res.status === 200) pass(`GET ${path}`, "200");
    else fail(`GET ${path}`, String(res.status));
  }

  const mapRes = await fetch(`${BASE}/api/mapbox-token`);
  if (mapRes.ok) {
    const mapCfg = await mapRes.json();
    if (mapCfg.enabled && mapCfg.token?.startsWith("pk.")) pass("Mapbox token API", "enabled");
    else fail("Mapbox token API", "token missing");
  }

  const title = "Tumaini Rongai — 2BR near stage (walkthrough)";
  const { data: existing } = await admin
    .from("properties")
    .select("id, latitude, longitude")
    .eq("owner_id", kevin.id)
    .eq("title", title)
    .maybeSingle();

  let listingId = existing?.id;
  if (existing) {
    pass("Tumaini listing", `exists ${listingId.slice(0, 8)}`);
    if (existing.latitude === TUMaini.lat && existing.longitude === TUMaini.lng) {
      pass("Map pin", `${TUMaini.lat}, ${TUMaini.lng}`);
    } else {
      fail(
        "Map pin",
        `expected ${TUMaini.lat},${TUMaini.lng} got ${existing.latitude},${existing.longitude}`,
      );
    }
  } else {
    const { data: created, error } = await admin
      .from("properties")
      .insert({
        owner_id: kevin.id,
        title,
        property_type: "two_bedroom",
        neighborhood: "Tumaini, Rongai",
        address: "Tumaini Estate, near Rongai stage",
        latitude: TUMaini.lat,
        longitude: TUMaini.lng,
        rent_kes: 22000,
        deposit_kes: 22000,
        bedrooms: 2,
        bathrooms: 1,
        description:
          "Bright 2BR in Tumaini Rongai, walking distance to matatu stage. Pinned on the tenant map.",
        amenities: ["Water", "Parking", "Security"],
        images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200"],
        is_active: true,
        is_vacant: true,
      })
      .select("id")
      .single();
    if (error) fail("Create Tumaini listing", error.message);
    else {
      listingId = created.id;
      pass("Create Tumaini listing", listingId);
      pass("Map pin", `${TUMaini.lat}, ${TUMaini.lng}`);
    }
  }

  if (listingId) {
    const tenantRes = await fetch(`${BASE}/tenant/property/${listingId}`);
    if (tenantRes.status === 200) pass("Tenant listing page", listingId.slice(0, 8));
    else fail("Tenant listing page", String(tenantRes.status));

    const editRes = await fetch(`${BASE}/landlord/properties/${listingId}/edit`);
    if (editRes.status === 200) pass("Landlord edit page", "200");
    else fail("Landlord edit page", String(editRes.status));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
