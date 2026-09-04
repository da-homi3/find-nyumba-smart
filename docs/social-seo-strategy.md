# NyumbaSearch — Social Media SEO & Social Discovery Strategy

**Last updated:** 2026-08-23  
**Canonical site:** https://nyumbasearch.com  
**App:** [Google Play](https://play.google.com/store/apps/details?id=ke.co.nyumbasearch.app)  
**Contact:** nyumbasearch101@gmail.com · +254 714 725 598

---

## Executive summary

NyumbaSearch has **strong technical SEO** (structured data, sitemap, area pages, AI crawler rules, FAQs) and now has **official social channels linked** from the website (Instagram, TikTok, YouTube, Facebook, X, founder LinkedIn, WhatsApp). Continue executing the content calendar so social search discovers NyumbaSearch properties and neighbourhoods.

This document is the baseline audit, strategy, and execution plan. Code implementations shipped in-repo are listed in [Technical implementation](#12-technical-implementation-recommendations).

---

## 1. Social SEO audit (baseline)

### What's already working

| Area | Evidence |
|------|----------|
| **Website SEO** | `buildPageHead()` — full OG/Twitter/geo meta on key pages |
| **Structured data** | Homepage JSON-LD: WebSite, Organization, RealEstateAgent, FAQPage, MobileApplication |
| **Location SEO** | 15 Nairobi neighbourhood pages at `/areas/{slug}` (Kilimani, Westlands, Karen, etc.) |
| **Property SEO** | Property detail pages with Product/Apartment schema, canonical URLs, rent in meta |
| **AI discoverability** | `llms.txt`, IndexNow, AI crawler allow rules in robots.txt |
| **Sitemap** | Dynamic sitemap with 300+ property URLs + static routes |
| **Brand FAQs** | 9 AEO-ready FAQs including apartments Nairobi, no-agent search, rental checklist |
| **App distribution** | Google Play listing with Kenya-focused copy and area keywords |
| **WhatsApp contact** | Customer care phone/email on site and Play Store |
| **Official social** | Instagram [@nyumbasearch_](https://www.instagram.com/nyumbasearch_/), TikTok [@nyumbasearch](https://www.tiktok.com/@nyumbasearch), YouTube [@nyumbasearch](https://www.youtube.com/@nyumbasearch), [Facebook](https://www.facebook.com/share/1E1M8jDjsg/), [X @NyumbaSearch](https://x.com/nyumbasearch), [LinkedIn (company)](https://www.linkedin.com/company/nyumbasearch), [Founder](https://www.linkedin.com/in/kevin-buluma-80a800377), WhatsApp customer care |

### What's underperforming

| Gap | Impact |
|-----|--------|
| **Thin social content library** | Profiles exist but need searchable property/area videos |
| **X bio under-optimized** | Current: “Your next home is just one search away” — expand with Nairobi/Kenya rental keywords |
| **Facebook share URL** | Prefer a vanity page URL (e.g. facebook.com/NyumbaSearch) when available for cleaner `sameAs` |
| **LinkedIn is founder-only** | Create a company page later; personal profile is linked as Founder for now |
| **No social referral tracking** | UTM conventions not yet applied on every post |
| **Comment → content loop** | No system to mine FAQ intent from social comments |

### What is missing

- Consistent searchable captions/videos across Instagram, TikTok, YouTube
- LinkedIn **company** page (founder profile is linked)
- Facebook vanity URL if Meta provides one
- 30/60/90-day content calendar **executed**
- Social SEO analytics dashboard
- WhatsApp Channel / broadcast list for new listings (wa.me contact is live)
- Comment mining → FAQ pipeline

### What should be removed

- **Do not** create fake profiles or placeholder social links (site hides links until env is set — correct)
- **Do not** copy competitor brands (e.g. Nyumba Hub is a separate entity)
- **Do not** use 30-hashtag blocks — captions carry search weight
- **Do not** auto-publish unverified rent/availability claims

### What should be rewritten

| Item | Before | After (recommended) |
|------|--------|---------------------|
| Social display name | "NyumbaSearch" only | `NyumbaSearch \| Houses & Apartments Kenya` |
| Bio (IG/TikTok/FB/X) | N/A | See `SOCIAL_BIO_TEMPLATE` in `src/lib/social/profiles.ts` |
| YouTube channel | N/A | `NyumbaSearch Kenya — Apartments & Houses for Rent` |
| LinkedIn company | N/A | Proptech positioning (see §4) |
| Property share captions | Generic or emoji-only | Use `buildPropertySocialPackage()` output |

### What should be expanded

- Area pages → social location guides (deep link to `/areas/{slug}`)
- FAQ content → short-form video scripts
- Verified listing tours → multi-platform repurposing
- Tenant Plus / product education → LinkedIn + YouTube how-tos
- Comment mining → FAQ and landing page updates

---

## 2. Keyword architecture

Organized by intent. Full programmatic matrix: `src/lib/social/keywords.ts` + `docs/social-content-plan.json`.

### Brand

`NyumbaSearch`, `Nyumba Search`, `NyumbaSearch Kenya`, `NyumbaSearch app`, `NyumbaSearch Nairobi`, `nyumbasearch.com`

### Transactional (priority)

| Keyword cluster | Destination URL pattern |
|-----------------|-------------------------|
| houses for rent in Nairobi | `/tenant?q=Nairobi` |
| apartments for rent in Nairobi | `/tenant?property_type=apartment` |
| affordable apartments in Nairobi | `/tenant?q=…&max_rent=…` |
| student accommodation Nairobi | `/tenant?q=student` |
| 2 bedroom apartment {area} | `/tenant?q={area}&bedrooms=2` |
| houses without agents in Kenya | `/about` + FAQ |
| verified rentals Nairobi | `/tenant` (verified filter) |

### Location matrix (15 static areas × 4 types = 60 base combos)

Areas: Kilimani, Westlands, Karen, Lavington, Kileleshwa, Kasarani, South B, South C, Roysambu, Rongai, Ruaka, Parklands, Langata, Ngong Road, Kiambu Road.

Pattern: `[property type] for rent in [area]` → `/areas/{slug}` or `/tenant?q={area}`

Expand only when `loadIndexableAreas()` confirms inventory thresholds.

### Informational / AEO

- how to find a house in Nairobi
- how much rent costs in Nairobi
- best areas to rent in Nairobi
- safest areas to live in Nairobi
- things to check before renting a house in Kenya
- how to avoid rental scams Kenya
- how to find a house without an agent

**Rule:** Never fabricate average rents. Point to live listings or area pages.

### Problem-based

- houses without agents · avoiding rental scams · finding vacant apartments · affordable rentals · verified properties · student accommodation

---

## 3. Platform optimization plan

### Instagram — P0

| Field | Recommendation |
|-------|----------------|
| Username | `@nyumbasearch` or closest available |
| Name | `NyumbaSearch \| Houses & Apartments Kenya` |
| Bio | Verified rental homes in Nairobi & Kenya. Map search, real listings, no broker spam. ↓ |
| Link | `nyumbasearch.com` or Linktree with area deep links |
| Category | Real Estate |
| Location | Nairobi, Kenya |

**Content:** Reels (property tours), carousels (area guides), searchable captions, location tags, alt text on images.

### TikTok — P0

Optimize for search: spoken keywords in first 3 seconds, on-screen text, description with location + property type.

Target searches: "affordable apartments in Nairobi", "best estates Nairobi", "how to find a house Nairobi", "2 bedroom Kilimani".

### YouTube — P1

Channel as search engine. Long-form area guides + Shorts from Reels/TikTok.

Title pattern: `Best 2 Bedroom Apartments in Kilimani Nairobi | NyumbaSearch`

Playlists: By neighbourhood, By property type, Rental education.

### Facebook — P1

Page + Reels. Local discovery via location tags. Cross-post area guides. Consider Nairobi rental groups (value-first, not spam).

### LinkedIn — P1

Position as **Kenyan proptech**, not a listing board.

Keywords: Kenyan proptech, real estate technology Kenya, property management technology, rental technology, African proptech.

Content: founder posts, product updates, tenant/landlord insights, partnerships.

### X — P2

Pinned post: brand + link to `/tenant`. Threads on rental tips, market observations (data-backed only).

### WhatsApp — P0

Channel or status for new verified listings. Link to property deep URLs. Already primary support channel — extend to discovery.

---

## 4. Social profile optimization (copy-paste templates)

From `src/lib/social/profiles.ts`:

**Display name:** `NyumbaSearch | Houses & Apartments Kenya`

**Bio (IG/TikTok/Facebook/X):**
> Verified rental homes in Nairobi & Kenya. Map search, real listings, no broker spam. Browse nyumbasearch.com

**YouTube description:**
> Apartment tours, neighbourhood guides, and rental tips for Nairobi & Kenya. Find verified listings on nyumbasearch.com

**LinkedIn:**
> Kenyan proptech — verified rental discovery, property management tools, and tenant intelligence for Nairobi & beyond.

**Configure env vars** (production + local):

```
VITE_SOCIAL_INSTAGRAM=https://www.instagram.com/nyumbasearch_/
VITE_SOCIAL_TIKTOK=https://www.tiktok.com/@nyumbasearch
VITE_SOCIAL_YOUTUBE=https://www.youtube.com/@nyumbasearch
VITE_SOCIAL_FACEBOOK=https://www.facebook.com/share/1E1M8jDjsg/
VITE_SOCIAL_LINKEDIN=https://www.linkedin.com/company/nyumbasearch
VITE_SOCIAL_X=https://x.com/nyumbasearch
VITE_SOCIAL_WHATSAPP=https://wa.me/254714725598
VITE_TWITTER_HANDLE=NyumbaSearch
```

Defaults are also baked into `OFFICIAL_SOCIAL_URLS` in `src/lib/social/profiles.ts`.

---

## 5. Content pillar system

| Pillar | Purpose | Example formats |
|--------|---------|-----------------|
| **1. Property Discovery** | High-intent conversion | Apartment tours, walkthroughs, new listings |
| **2. Location Guides** | Informational + local SEO | "Living in Kilimani", area commute/amenities |
| **3. Education** | Trust + AEO | Rental checklist, scam avoidance, lease tips |
| **4. Market Intelligence** | Authority (data only) | Popular areas from search logs, bedroom trends |
| **5. Product Education** | Activation | Map search, save, contact unlock, Tenant Plus |
| **6. Trust** | Conversion | Verified badges, real tours, testimonials (with permission) |

---

## 6. Location-content strategy

**When to create content:**

1. Area has indexable inventory (`loadIndexableAreas()`)
2. Location data verified in admin
3. Useful guide content possible (not thin spam)
4. Search intent exists

**Hierarchy:** County → Constituency → Ward → Estate → Neighbourhood → Road (use NyumbaSearch location DB; cap automated pages).

**Social → web mapping:**

| Social topic | URL |
|--------------|-----|
| Apartments in Kilimani | `nyumbasearch.com/areas/kilimani` |
| Search Westlands | `nyumbasearch.com/tenant?q=Westlands` |
| Specific listing | `nyumbasearch.com/tenant/property/{id}` |

Generate packages: `buildLocationGuidePackage({ areaName, slug })`.

---

## 7. Video SEO framework

Every property video uses `PROPERTY_VIDEO_STORYBOARD` + `buildPropertySocialPackage()`.

| Second | Beat |
|--------|------|
| 0–3 | Visual hook |
| 3–8 | Property type + neighbourhood (spoken + on-screen) |
| 8–25 | Living areas |
| 25–40 | Bedrooms, kitchen, bath |
| 40–55 | Amenities |
| 55–65 | Location / commute |
| 65–70 | CTA: "Find this property on NyumbaSearch" |

**Pre-publish checklist:** search keyword · title · hook · spoken keywords · on-screen text · caption · description · hashtags · location · CTA · deep link URL.

---

## 8. 30 / 60 / 90-day content strategy

Seed calendar: `npm run export:social-plan` → `docs/social-content-plan.json`

### Days 1–30 (launch foundation) — P0

| Week | Focus | Platforms |
|------|-------|-----------|
| 1 | Claim profiles, set bios, link website | All |
| 1–2 | 3 area guides (Kilimani, Westlands, Karen) | Reels + TikTok + YT Shorts |
| 2–3 | 5 verified property tours | Reels + TikTok |
| 3 | Product: "How to search on NyumbaSearch" | YT + IG carousel |
| 4 | Education: rental checklist | All short-form |
| 4 | Trust: verified listing explainer | LinkedIn + IG |

### Days 31–60 (scale) — P1

- 2 property tours per week (top inventory neighbourhoods)
- 1 location guide per week (rotate through 15 areas)
- 1 educational post per week
- Start YouTube long-form: "Living in {area}" series
- LinkedIn: 2 founder/company posts per week
- UGC repost pilot (with written permission)

### Days 61–90 (optimize) — P1–P2

- Double down on top-performing keywords (from analytics)
- A/B hooks and thumbnails
- Comment FAQ → 3 new videos/posts
- Market intelligence post (only from real NyumbaSearch data)
- WhatsApp channel: weekly digest of new listings by area

---

## 9. Social → website → app conversion funnel

```
Social content (keyword-matched)
    ↓ deep link (not homepage)
Area page / property page / search URL
    ↓
Browse / map / filter
    ↓
Property detail
    ↓
Save / contact unlock
    ↓
Account creation
    ↓
Tenant Plus (where relevant)
    ↓
App install (Play Store)
```

**UTM convention:**

`?utm_source={platform}&utm_medium=social&utm_campaign={pillar}&utm_content={slug}`

Example: `nyumbasearch.com/areas/kilimani?utm_source=instagram&utm_medium=social&utm_campaign=location_guide&utm_content=kilimani`

---

## 10. AEO / GEO strategy

NyumbaSearch already answers core questions in `NYUMBASEARCH_FAQS` (JSON-LD on homepage + about).

**Expand with:**

- Clear Q&A structure in captions and video descriptions
- Area pages with factual, non-fabricated copy
- `llms.txt` updated with social profiles when configured
- Original insights only from verified platform data

**Target AI queries:**

- Where can I find apartments in Nairobi? → FAQ + `/areas/*`
- Best areas to rent? → FAQ + area guides
- How to find a house without an agent? → FAQ + product content
- What to check before renting? → FAQ + checklist video

---

## 11. Analytics framework

### Discovery metrics

- Profile visits, search impressions (IG/TikTok/YT Studio)
- Non-follower reach, video search terms

### Engagement

- Watch time, completion rate, saves, shares, comments

### Website (GA4)

- Sessions by `utm_source`
- Landing pages from social
- Property views, searches, registrations, contact actions

### Business

- Leads, enquiries, Tenant Plus conversions, landlord signups

**Dashboard:** Start with GA4 + native platform insights; build internal dashboard P2.

---

## 12. Technical implementation recommendations

### Shipped in this repo

| File | Purpose |
|------|---------|
| `src/lib/social/profiles.ts` | Env-based social URLs, bio templates, `sameAs` |
| `src/lib/social/keywords.ts` | Keyword lists, location matrix, tiered hashtags |
| `src/lib/social/content-engine.ts` | Property/location packages, story-first video storyboard, 30-day seed |
| `src/lib/social/creative/` | Content intelligence engine: memory, fatigue, scoring, quality gate, briefs |
| `docs/social-creative-memory.json` | Post performance memory (null metrics until measured) |
| `npm run social:brief` | Generate today’s scored creative brief |
| `src/components/SocialProfileLinks.tsx` | Footer/about links (configured profiles only) |
| `src/lib/seo/brand-entity.ts` | Organization `sameAs` + MobileApplication schema |
| `src/lib/seo/head.ts` | `twitter:site`, OG image dimensions/alt |
| `src/lib/seo/faq.ts` | 4 new AEO FAQs |
| `src/lib/seo/llms.ts` | Social block in llms.txt |
| `src/routes/about.tsx` | Follow section + profile setup hints |
| `src/routes/contact.tsx`, `finance.tsx` | Full `buildPageHead()` meta |
| `property-detail-head.ts` | `og:type` → `product` |
| `scripts/export-social-content-plan.mjs` | Export keyword matrix + calendar |
| `tests/unit/social-seo.test.ts` | Unit tests |

### Recommended next (code)

| Item | Priority |
|------|----------|
| Landlord dashboard: "Copy social caption" using `buildPropertySocialPackage()` | P1 |
| Auto-append UTM params to generated destination URLs | P1 |
| Property share flow: pre-filled caption in native share sheet | P2 |
| Admin: social content export per listing | P2 |

### Operator actions (non-code)

| Item | Priority |
|------|----------|
| Create/claim official profiles | P0 |
| Set `VITE_SOCIAL_*` in production env | P0 |
| Deploy latest build | P0 |
| Produce first 10 videos using storyboard | P0 |
| Submit YouTube channel to Google Search Console | P1 |

---

## 13. Before / after SEO comparison

| Dimension | Before | After (with env + content execution) |
|-----------|--------|--------------------------------------|
| Social entity graph | Website only | Organization linked to official profiles via `sameAs` |
| Footer discovery | Play Store + contact | + configured social icons |
| Twitter meta | Generic card | + `twitter:site` when handle configured |
| AI crawlers | llms.txt, FAQs | + official social URLs in llms.txt |
| Property sharing | Basic URL | SEO caption/title/hashtag packages in code |
| Page meta consistency | Gaps on contact/finance | Full OG/Twitter/geo |
| Property OG type | `website` | `product` |
| Content calendar | None | 30-day seed + export script |
| Video framework | None | Storyboard + generator |
| Social referral tracking | Undocumented | UTM convention defined |

---

## 14. Priority action list

### P0 — Critical (this week)

1. **Create and verify** official Instagram, TikTok, YouTube, Facebook, LinkedIn, X profiles
2. **Set production env vars** `VITE_SOCIAL_*` and redeploy
3. **Publish 3 area guide Reels** (Kilimani, Westlands, Karen) with deep links
4. **Publish 3 property tours** from verified inventory
5. **Add UTM tags** to all social bio links and post CTAs

### P1 — High impact (weeks 2–4)

6. Execute 30-day calendar (`docs/social-content-plan.json`)
7. Launch YouTube channel with 2 long-form area guides
8. LinkedIn company page + bi-weekly proptech posts
9. WhatsApp channel for weekly listing digest
10. GA4 social landing page report + weekly review
11. Landlord "copy social caption" UI in dashboard

### P2 — Growth (days 31–90)

12. Repurposing engine: 1 tour → 8 platform-native assets
13. Comment mining → FAQ/video pipeline
14. Market intelligence content from real search data
15. UGC program with permission workflow
16. Competitor content gap analysis (monthly)

### P3 — Nice to have

17. Custom link-in-bio with area shortcuts
18. Social SEO internal dashboard
19. Automated draft captions in listing publish flow (human review gate)
20. Google Business Profile if local office verified

---

## 27. Competitor analysis (initial)

| Competitor type | Example | Their strength | NyumbaSearch opportunity |
|-----------------|---------|----------------|---------------------------|
| Listing portals | Property24, BuyRentKenya | Brand search, inventory | Verified direct listers, map-first, no broker spam |
| Social-native creators | Independent TikTok tour creators | Video search volume | Official tours with deep links + verification |
| Similar brand names | Nyumba Hub | Established TikTok | Distinct proptech brand; do not confuse entities |
| Classifieds | Facebook Marketplace | Reach | Trust, verification, structured search |

**Do not copy** — own: verified listings, neighbourhood intelligence, Kenya payments, proptech narrative.

---

## 28. Social SEO content database schema

Store in Notion/Airtable/Sheet (or extend `social-content-plan.json`):

```
topic, keyword, platform, location, property_type, search_intent,
content_format, title, hook, caption, description, hashtags,
CTA, destination_url, utm_campaign, status, performance_notes
```

---

## Brand voice

**Sound like:** Modern, trustworthy, Kenyan, helpful, data-driven, premium, human, straightforward.

**Avoid:** Spam, generic broker tone, corporate ads, AI filler, clickbait, fabricated stats.

---

## Core principle

> When someone searches anywhere online for a property, neighbourhood, estate, rental question, or housing solution that NyumbaSearch can answer, NyumbaSearch should have a highly relevant, authoritative, searchable piece of content ready to be discovered.

**Accuracy → Usefulness → Searchability → Trust → Conversion.**
