import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (!existsSync(path)) return env;
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
  return env;
}

const env = loadEnv();
const site = (
  process.env.PUBLIC_APP_URL ??
  env.PUBLIC_APP_URL ??
  process.env.SITE_URL ??
  env.SITE_URL ??
  "https://nyumbasearch.com"
).replace(/\/$/, "");

const SERVICE_CATEGORIES = [
  "electricians",
  "plumbers",
  "painters",
  "internet",
  "security",
  "movers",
  "cleaning",
  "solar",
  "pest_control",
  "carpentry",
  "furniture",
  "interior_design",
  "appliance_repair",
  "gardening",
  "water_services",
  "generators",
  "moving_supplies",
  "ac_repair",
];

const staticPaths = [
  "",
  "/tenant",
  "/tenant/map",
  "/auth",
  "/landlord",
  "/pricing",
  "/services",
  ...SERVICE_CATEGORIES.map((c) => `/services/${c}`),
  "/privacy",
  "/terms-of-service",
  "/cookie-policy",
  "/refund-policy",
  "/data-deletion",
  "/acceptable-use-policy",
  "/landlord-agreement",
  "/contact",
  "/about",
];

function urlEntry(loc, { lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function fetchActivePropertyIds() {
  const url = process.env.SUPABASE_URL ?? env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.warn("[sitemap] Supabase env missing — static pages only");
    return [];
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const properties = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn("[sitemap] property fetch failed:", error.message);
      break;
    }
    if (!data?.length) break;
    properties.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return properties;
}

const today = new Date().toISOString().slice(0, 10);
const staticUrls = staticPaths.map((path) =>
  urlEntry(`${site}${path}`, {
    lastmod: today,
    changefreq: "daily",
    priority: path === "" ? "1.0" : path.startsWith("/services") ? "0.85" : "0.8",
  }),
);

const properties = await fetchActivePropertyIds();
const propertyUrls = properties.map((property) => {
  const lastmod =
    typeof property.updated_at === "string" ? property.updated_at.slice(0, 10) : today;
  return urlEntry(`${site}/tenant/property/${property.id}`, {
    lastmod,
    changefreq: "weekly",
    priority: "0.6",
  });
});

const urls = [...staticUrls, ...propertyUrls].join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(
  `Wrote public/sitemap.xml (${staticPaths.length} static + ${propertyUrls.length} property URLs)`,
);
