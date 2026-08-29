# NyumbaSearch Investor Package — Research Notes & Data Integrity

**Research date:** 11 August 2026  
**Primary sources:** https://nyumbasearch.com (live), public sitemap, product codebase (for pricing/structure confirmation), external market publications.

---

## Classification legend

| Label | Meaning |
|-------|---------|
| **VERIFIED LIVE DATA** | Observed directly on the live website or public sitemap on the research date |
| **INTERNAL COMPANY DATA** | Company-provided; not independently verified from public surfaces |
| **WEBSITE-PUBLISHED CLAIM** | Appears on the live site as marketing copy; requires internal confirmation before investor use as audited fact |
| **EXTERNAL MARKET DATA** | Third-party publication with source + year |
| **ESTIMATE / MODEL** | Transparent illustrative calculation; not a claimed valuation |

---

## Traction (as of 11 August 2026)

| Metric | Value | Classification | Source |
|--------|-------|----------------|--------|
| Live property listings | **295 live · 5 uploading** | VERIFIED LIVE DATA | Tenant browse UI (`/tenant`) text: “295 live · 5 uploading” |
| Indexed property pages | **324** unique `/tenant/property/{id}` URLs | VERIFIED LIVE DATA | `https://nyumbasearch.com/sitemap.xml` |
| Service providers | **214** trusted providers across Kenya | VERIFIED LIVE DATA | `/services` page copy |
| Service categories | **24** categories with provider counts | VERIFIED LIVE DATA | `/services` |
| Registered users | **136** | INTERNAL COMPANY DATA — requires confirmation | Company-provided placeholder; not shown publicly |
| Listing accounts | **22** | INTERNAL COMPANY DATA — requires confirmation | Company-provided placeholder; not shown publicly |
| App downloads | — | Not publicly disclosed | Google Play listing for `ke.co.nyumbasearch.app` returned **HTTP 404** on research date |
| Revenue / ARR / GMV | — | Not publicly disclosed | — |
| Funding / valuation | — | Not publicly disclosed | — |
| “Over 2,400 verifications · 98% accuracy” | On `/verify` | WEBSITE-PUBLISHED CLAIM — requires confirmation | Do not treat as audited traction |

**Editorial decision for package:** Lead with **295+ live listings** and **214 service providers** as public traction. Present 136 users / 22 listing accounts only as internal placeholders, clearly tagged.

---

## Company & contact (public)

| Item | Value | Source |
|------|-------|--------|
| Website | https://nyumbasearch.com | Live |
| Email | nyumbasearch101@gmail.com | Contact page + schema.org |
| Phone | 0714725598 / +254714725598 | Contact page + schema.org |
| Co-founders | Faith Wanjiku (Product), Kevin Buluma (Engineering) | `/about` |
| Location focus | Nairobi, Kenya (national county filters available) | Live product |
| Google Play | Package `ke.co.nyumbasearch.app` — **not publicly live** | Play URL 404; submission kit in repo |
| App Store | Not found | — |

---

## Product surfaces verified live

- Homepage, tenant discovery, map search, property detail
- Services directory, pricing, verify, finance referral form, insurance quote form
- Landlord portal landing, property manager portal landing, agency routes in sitemap
- Neighbourhood intelligence (water, security, internet, noise, commute)
- Verification badges (Verified / Business Verified)
- Contact unlock / Plus monetization messaging
- M-Pesa payment messaging on pricing

---

## Pricing (live `/pricing` + codebase alignment)

**Landlord:** Free (0) · Pro 999 · Premium 2,999 KES/mo  
**Property manager:** Solo 2,500 · Team 7,500 · Enterprise 10,000 KES/mo  
**Agency:** Starter 5,000 · Professional 10,000 · Enterprise 15,000 KES/mo  
**Boosts:** Spotlight 2,500 / 7d · Homepage 5,000 / 14d · Full Campaign 12,000 / 30d  
**NyumbaSearch Plus:** 500 KES/mo  
**Paid site verification:** Basic 1,000 · Standard 2,500 · Express 5,000 KES  

Landlord/manager applications require **operations approval** before listing (stated on portal pages).

---

## Partnership language caution

- `/finance` mentions illustrative lender rate context (e.g. KCB, Equity, Co-op). **Do not present as signed exclusive partnerships** unless confirmed.
- `/insurance` states NyumbaSearch earns a referral commission on quote requests. Treat as **planned/productized referral capability**, not as named insurer contracts unless confirmed.

---

## External market sources used

1. World Bank — Kenya housing deficit / unaffordability context (historical ~2M unit deficit framing).  
2. Cytonn Nairobi Metropolitan Area Residential Report 2025 — urbanization 3.8% p.a. (World Bank 2023), RE GDP contribution figures citing KNBS Economic Survey 2025; housing demand ~250k vs supply ~50k (CAHF).  
3. KNBS 2023/24 Kenya Housing Survey Basic Report — national housing statistics programme.  
4. CAHF Kenya housing finance profile (2025) — urbanization / affordability context.  
5. IEA Kenya housing sector brief summarizing KNBS survey tenancy/rent findings.

All TAM/SAM/SOM figures in the deck are **illustrative models** with assumptions disclosed — not claimed market valuations.
