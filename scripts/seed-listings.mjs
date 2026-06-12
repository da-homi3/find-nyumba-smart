/**
 * Seed live Supabase properties from demo listing data.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Usage: node scripts/seed-listings.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  isBrokenListingImageUrl,
  listingPlaceholderUrl,
  normalizePropertyImages,
} from "./listing-placeholders.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const env = {};
  try {
    const text = readFileSync(join(root, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch {
    /* optional */
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v && !env[k]) env[k] = v;
  }
  return env;
}

const IMG = (seed) => listingPlaceholderUrl(seed);

const now = new Date().toISOString();

/** Sample listings — new UUIDs on each seed run are avoided via upsert on title+neighborhood. */
const LISTINGS = [
  {
    title: "Bright 2BR near Yaya Centre",
    property_type: "two_bedroom",
    neighborhood: "Kilimani",
    address: "Argwings Kodhek Rd",
    latitude: -1.2924,
    longitude: 36.7821,
    rent_kes: 42000,
    deposit_kes: 84000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 85,
    description: "Spacious 2-bedroom with borehole backup and 24/7 security. Fibre-ready building.",
    amenities: ["Parking", "Borehole", "Fibre", "Balcony"],
    images: [IMG(1), IMG(2)],
    is_verified: true,
    authenticity_score: 88,
    health_score: 82,
  },
  {
    title: "Modern studio — Westlands Square",
    property_type: "studio",
    neighborhood: "Westlands",
    address: "Ring Rd Parklands",
    latitude: -1.2678,
    longitude: 36.8075,
    rent_kes: 32000,
    deposit_kes: 64000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 42,
    description: "Compact studio ideal for young professionals. Zuku fibre installed.",
    amenities: ["Fibre", "Lift", "Security"],
    images: [IMG(3)],
    is_verified: true,
    authenticity_score: 76,
    health_score: 74,
  },
  {
    title: "Affordable bedsitter — Kasarani Mwiki",
    property_type: "bedsitter",
    neighborhood: "Kasarani",
    address: "Mwiki Rd",
    latitude: -1.2245,
    longitude: 36.8998,
    rent_kes: 14000,
    deposit_kes: 28000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 22,
    description: "Clean bedsitter near Thika Road. Shared water tank.",
    amenities: ["Water tank", "Security"],
    images: [IMG(4)],
    is_verified: false,
    authenticity_score: 65,
    health_score: 60,
  },
  {
    title: "3BR family home — Lavington",
    property_type: "three_bedroom",
    neighborhood: "Lavington",
    address: "James Gichuru Rd",
    latitude: -1.2798,
    longitude: 36.7689,
    rent_kes: 95000,
    deposit_kes: 190000,
    bedrooms: 3,
    bathrooms: 3,
    area_sqm: 145,
    description: "Quiet compound with parking and garden. DSTV-ready.",
    amenities: ["Parking", "Garden", "Security", "Borehole"],
    images: [IMG(5), IMG(6)],
    is_verified: true,
    authenticity_score: 92,
    health_score: 88,
  },
  {
    title: "1BR apartment — South B",
    property_type: "one_bedroom",
    neighborhood: "South B",
    address: "Muhoho Ave",
    latitude: -1.3123,
    longitude: 36.8345,
    rent_kes: 28000,
    deposit_kes: 56000,
    bedrooms: 1,
    bathrooms: 1,
    area_sqm: 55,
    description: "Near Nairobi West shopping centre. Reliable water supply.",
    amenities: ["Parking", "Security"],
    images: [IMG(7)],
    is_verified: true,
    authenticity_score: 80,
    health_score: 78,
  },
  {
    title: "Bedsitter — Umoja Innercore",
    property_type: "bedsitter",
    neighborhood: "Umoja",
    address: "Innercore",
    latitude: -1.3012,
    longitude: 36.8912,
    rent_kes: 12000,
    deposit_kes: 24000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 20,
    description: "Budget-friendly with good matatu access.",
    amenities: ["Water tank"],
    images: [IMG(8)],
    is_verified: false,
    authenticity_score: 58,
    health_score: 55,
  },
  {
    title: "2BR with balcony — Parklands",
    property_type: "two_bedroom",
    neighborhood: "Parklands",
    address: "Forest Rd",
    latitude: -1.2634,
    longitude: 36.8156,
    rent_kes: 55000,
    deposit_kes: 110000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 90,
    description: "Bright unit with city views. 24hr security.",
    amenities: ["Parking", "Lift", "Fibre", "Balcony"],
    images: [IMG(9), IMG(10)],
    is_verified: true,
    authenticity_score: 85,
    health_score: 83,
  },
  {
    title: "Single room — Githurai 44",
    property_type: "single_room",
    neighborhood: "Githurai",
    address: "Githurai 44",
    latitude: -1.1987,
    longitude: 36.9456,
    rent_kes: 8000,
    deposit_kes: 16000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 15,
    description: "Affordable single room near stage.",
    amenities: ["Shared bathroom"],
    images: [IMG(11)],
    is_verified: false,
    authenticity_score: 55,
    health_score: 52,
  },
];

const DEMO_LANDLORD_EMAIL = "demo-landlord@nyumbasearch.app";
const DEMO_LANDLORD_PASSWORD = `NyumbaDemo-${randomUUID().slice(0, 8)}!`;

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  let landlordId = existingUsers?.users?.find((u) => u.email === DEMO_LANDLORD_EMAIL)?.id;

  if (!landlordId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: DEMO_LANDLORD_EMAIL,
      password: DEMO_LANDLORD_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "NyumbaSearch Demo Landlord" },
    });
    if (createErr) {
      console.error("Could not create demo landlord:", createErr.message);
      process.exit(1);
    }
    landlordId = created.user.id;
    console.log("Created demo landlord user:", DEMO_LANDLORD_EMAIL);
  } else {
    console.log("Using existing demo landlord:", DEMO_LANDLORD_EMAIL);
  }

  await admin.from("profiles").upsert({
    id: landlordId,
    full_name: "NyumbaSearch Demo Landlord",
    phone: "+254700000001",
    is_portal_active: true,
    active_portal: "landlord",
  });

  const { data: existingRole } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", landlordId)
    .eq("role", "landlord")
    .maybeSingle();

  if (!existingRole) {
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: landlordId, role: "landlord" });
    if (roleErr) console.warn("Role insert:", roleErr.message);
  }

  const { data: existingProps } = await admin
    .from("properties")
    .select("id, title, neighborhood, images")
    .eq("owner_id", landlordId);

  const existingKeys = new Set((existingProps ?? []).map((p) => `${p.title}::${p.neighborhood}`));

  let inserted = 0;
  let skipped = 0;
  let imagesFixed = 0;

  for (const row of (
    await admin.from("properties").select("id, title, images").eq("is_active", true)
  ).data ?? []) {
    const needsFix = (row.images ?? []).some((url) => isBrokenListingImageUrl(url));
    if (!needsFix) continue;
    const images = normalizePropertyImages(row.images, row.id);
    const { error: fixErr } = await admin.from("properties").update({ images }).eq("id", row.id);
    if (fixErr) console.warn(`Image fix "${row.title}":`, fixErr.message);
    else imagesFixed++;
  }

  for (const listing of LISTINGS) {
    const key = `${listing.title}::${listing.neighborhood}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const row = {
      id: randomUUID(),
      owner_id: landlordId,
      title: listing.title,
      property_type: listing.property_type,
      neighborhood: listing.neighborhood,
      address: listing.address,
      latitude: listing.latitude,
      longitude: listing.longitude,
      rent_kes: listing.rent_kes,
      deposit_kes: listing.deposit_kes,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      area_sqm: listing.area_sqm,
      description: listing.description,
      amenities: listing.amenities,
      images: listing.images,
      video_url: null,
      tour_url: null,
      is_verified: listing.is_verified,
      is_active: true,
      is_vacant: true,
      authenticity_score: listing.authenticity_score,
      health_score: listing.health_score ?? 70,
      available_from: now,
      views: 0,
    };

    const { error } = await admin.from("properties").insert(row);
    if (error) {
      console.error(`Failed "${listing.title}":`, error.message);
    } else {
      inserted++;
      existingKeys.add(key);
    }
  }

  const { count } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  // Assign any active listings missing an owner to the demo landlord
  const { count: orphanCount } = await admin
    .from("properties")
    .update({ owner_id: landlordId })
    .eq("is_active", true)
    .is("owner_id", null)
    .select("id", { count: "exact", head: true });

  if (orphanCount) {
    console.log(`Assigned ${orphanCount} orphan listing(s) to demo landlord.`);
  }

  console.log(
    `Done. Inserted ${inserted}, skipped ${skipped} (already seeded), fixed ${imagesFixed} broken image set(s).`,
  );
  console.log(`Active listings in DB: ${count ?? "?"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
