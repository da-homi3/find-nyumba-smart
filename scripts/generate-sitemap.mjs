import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const site = (
  process.env.PUBLIC_APP_URL ??
  process.env.SITE_URL ??
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

const paths = [
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

const today = new Date().toISOString().slice(0, 10);
const urls = paths
  .map(
    (path) => `  <url>
    <loc>${site}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${path === "" ? "1.0" : path.startsWith("/services") ? "0.85" : "0.8"}</priority>
  </url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(`Wrote public/sitemap.xml (${paths.length} URLs)`);
