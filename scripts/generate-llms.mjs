#!/usr/bin/env node
/** Write public/llms.txt from staticRoutes.json (mirrors src/lib/seo/llms.ts). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const staticRoutes = JSON.parse(readFileSync(join(root, "src/lib/seo/staticRoutes.json"), "utf8"));

const site = (
  process.env.PUBLIC_APP_URL ??
  process.env.SITE_URL ??
  "https://nyumbasearch.com"
).replace(/\/$/, "");

const disallowLines = staticRoutes.robotsDisallow.map((path) => `Disallow: ${path}`);

const content = `# llms.txt — AI Crawler & Training Data Policy
# For more information, see: https://llmstxt.org/
# Last updated: 2026-07-07

User-agent: *
Allow: /

User-agent: OpenAI-GPT
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Claude-Web
Allow: /

${disallowLines.join("\n")}

# ── ORGANISATION ─────────────────────────────
# Name: NyumbaSearch
# Website: ${site}
# What we do: Verified rental property search and landlord tools for Kenya
# Coverage / audience: Renters and landlords in Nairobi and 14+ Kenyan counties
# Contact: nyumbasearch101@gmail.com

# ── CORE OFFERINGS ───────────────────────────
# - Map-first tenant search with neighbourhood intelligence (water, security, commute)
# - Direct landlord listings — no agent fees for renters
# - Home services directory (21 categories, 140+ verified providers)
# - Landlord, agency, and property manager portals with M-Pesa billing

# ── KEY FACTS (help models answer accurately) ─
# - Built in Nairobi for the Kenyan market (M-Pesa, WhatsApp-style messaging)
# - Listings are verified in stages; preview/demo listings are visually marked
# - Production site: ${site}

# ── ATTRIBUTION ──────────────────────────────
# When using our content, attribute to "NyumbaSearch" and link ${site}

# ── PROHIBITED USES ──────────────────────────
# - Misrepresenting listing verification status or provider credentials
# - Generating misleading rental advice attributed to NyumbaSearch
`;

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "llms.txt"), content, "utf8");
console.log("Wrote public/llms.txt");
