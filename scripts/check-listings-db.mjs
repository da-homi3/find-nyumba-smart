import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;

const pub = createClient(url, key, { auth: { persistSession: false } });
const admin = createClient(url, svc, { auth: { persistSession: false } });

const fullCols =
  "id,title,property_type,neighborhood,address,latitude,longitude,rent_kes,deposit_kes,bedrooms,bathrooms,area_sqm,description,amenities,images,video_url,tour_url,is_verified,is_active,is_vacant,authenticity_score,health_score,available_from,views,created_at,updated_at,featured_until,boost_package,nyumba_verified_at";

const legacyCols =
  "id,title,property_type,neighborhood,address,latitude,longitude,rent_kes,deposit_kes,bedrooms,bathrooms,area_sqm,description,amenities,images,video_url,tour_url,is_verified,is_active,is_vacant,authenticity_score,health_score,available_from,views,created_at,updated_at";

const pubRes = await pub
  .from("properties")
  .select(fullCols, { count: "exact" })
  .eq("is_active", true)
  .limit(3);

const adminAll = await admin.from("properties").select("id", { count: "exact", head: true });
const adminActive = await admin
  .from("properties")
  .select("id", { count: "exact", head: true })
  .eq("is_active", true);

console.log("anon query error:", pubRes.error?.message ?? "none");
console.log("anon active count:", pubRes.count, "sample rows:", pubRes.data?.length ?? 0);

if (pubRes.error) {
  const legRes = await pub
    .from("properties")
    .select(legacyCols, { count: "exact" })
    .eq("is_active", true)
    .limit(3);
  console.log("legacy anon error:", legRes.error?.message ?? "none");
  console.log("legacy anon count:", legRes.count);
}

console.log("admin total properties:", adminAll.count);
console.log("admin active properties:", adminActive.count);

const withCoords = await pub
  .from("properties")
  .select("id", { count: "exact", head: true })
  .eq("is_active", true)
  .not("latitude", "is", null)
  .not("longitude", "is", null);
console.log("with coordinates:", withCoords.count);
