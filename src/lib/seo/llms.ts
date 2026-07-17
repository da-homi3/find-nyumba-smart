import { CUSTOMER_CARE_EMAIL, getSiteUrl } from "@/lib/site";
import { ROBOTS_DISALLOW_PATHS } from "@/lib/seo/static-routes";

const LAST_UPDATED = "2026-07-07";

export function buildLlmsTxt(): string {
  const site = getSiteUrl();
  const disallowLines = ROBOTS_DISALLOW_PATHS.map((path) => `Disallow: ${path}`);

  return `# llms.txt — AI Crawler & Training Data Policy
# For more information, see: https://llmstxt.org/
# Last updated: ${LAST_UPDATED}

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
# Contact: ${CUSTOMER_CARE_EMAIL}

# ── CORE OFFERINGS ───────────────────────────
# - Map-first tenant search with neighbourhood intelligence (water, security, commute)
# - Direct listings from verified property owners
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
}
