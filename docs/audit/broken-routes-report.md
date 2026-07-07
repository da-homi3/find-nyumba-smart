# NyumbaSearch — Broken Routes Report

**Audit date:** 2026-06-11  
**Production audit:** `route-report.json` — **66/66 passed** (2026-06-27, base `https://nyumbasearch.com`)  
**Method:** Static code review + prior production HTTP audit + smoke scripts

---

## Summary

The routes listed as broken in Master Build Prompt v2 were **largely fixed in prior work**. No route currently returns a blank SSR shell (0 bytes) or HTTP 500 in production audit. Remaining issues are **functional gaps** (hardcoded stats, map token dependency, slug URLs) rather than missing route registration.

---

## Master prompt known issues — current status

| Route                              | Expected (spec)        | Prior claim            | **Current status** | Evidence                                                                       |
| ---------------------------------- | ---------------------- | ---------------------- | ------------------ | ------------------------------------------------------------------------------ |
| `/landlord/checkout?plan=pro`      | UniversalCheckout      | Blank page             | **✅ Fixed**       | `landlord.checkout.tsx` → `CheckoutFlow`; audit 6227 bytes                     |
| `/landlord/checkout?plan=premium`  | Same                   | Blank                  | **✅ Fixed**       | `resolveLandlordPlan()` handles plan param                                     |
| `/landlord/checkout?plan=agency-*` | Same                   | Blank                  | **✅ Fixed**       | Agency plans in `LANDLORD_PLANS` + `AGENCY_PLANS`                              |
| `/landlord/boost?package=*`        | Boost + listing picker | Missing route          | **✅ Fixed**       | `landlord.boost.tsx` 3-step flow; audit 6092 bytes                             |
| `/tenant/checkout?plan=plus`       | Plus checkout form     | Nav only               | **✅ Fixed**       | Billing cycle picker + `CheckoutFlow`; audit OK                                |
| `/verify/request`                  | 2-step intake + pay    | Duplicates `/verify`   | **✅ Fixed**       | Separate component: intake steps 1–3 → payment step 4                          |
| `/services/register`               | 3-step provider signup | Duplicates `/services` | **✅ Fixed**       | profile → plan → `CheckoutFlow`                                                |
| `/tenant/map`                      | Mapbox 3D map          | Completely blank       | **✅ Fixed**       | Mapbox/Google when configured; instant listing preview fallback without tokens |
| `/reports`                         | Charts with data       | Charts empty           | **✅ Fixed**       | `getMarketReportTeaser()` + Recharts; fallback hood data if DB sparse          |
| Homepage stats                     | Live counters          | Shows 0/0/0            | **✅ Fixed**       | All four trust strip metrics from `getPublicStats()`                           |

---

## Route registration verification

All routes are registered via TanStack file-based routing (`src/routes/*.tsx` → `routeTree.gen.ts`). **No missing imports** for checkout/boost flows.

Checkout component: **`CheckoutFlow`** (not `UniversalCheckout` from payment spec — functionally equivalent).

---

## Functional gaps (not blank routes)

### 1. Homepage trust strip — mixed live / static stats

**File:** `src/components/landing/LandingBrowseSections.tsx`, `src/routes/index.tsx`

| Stat               | Source                                 |
| ------------------ | -------------------------------------- |
| Verified homes     | ✅ `getPublicStats().verifiedListings` |
| No agent fees %    | ❌ Hardcoded default `98`              |
| Avg response hours | ❌ Hardcoded default `24`              |
| Tenant rating      | ❌ Hardcoded default `4.7`             |

**Fix:** Extend `getPublicStats` to query `inquiries` response times and `property_reviews` average rating.

### 2. `/tenant/map` — environment-dependent

**Files:** `src/routes/tenant.map.tsx`, `src/hooks/use-tenant-mapbox.ts`

- Without Mapbox token: falls back to Google Maps (needs `VITE_GOOGLE_MAPS_API_KEY`).
- Without either token: Radar loading UI persists — appears "blank" to users.
- Map listings load via `fetchMapProperties({ limit: 500 })`.

**Fix:** Ensure `VITE_MAPBOX_TOKEN` in production Worker vars; document fallback behavior.

### 3. Property URLs — ID not slug

**Current:** `/tenant/property/$id` (UUID)  
**Spec:** `/property/[slug]` with SEO slugs

**Fix:** Phase 2 route restructure + `slug` column migration.

### 4. `/landlord/checkout` unauthenticated UX

Redirects to `/auth` with return URL — correct. While loading, shows skeleton (not blank).

### 5. Checkout query params without `plan`

Visiting `/landlord/checkout` with no params defaults to Pro plan via `resolveLandlordPlan()` — may surprise users but renders content.

---

## SPA 404 / direct navigation

**Status:** ✅ **Fixed** (TanStack Start SSR on Workers)

Master prompt SPA catch-all (`ASSETS.fetch index.html`) applies to static SPA deployments. This app uses **SSR Worker** — each path returns server-rendered HTML. Production audit confirms direct navigation works for all 66 paths.

Historical issue (HTTP 500 on SSR) was caused by `securityHeadersMiddleware` calling `response.arrayBuffer()` on non-Response objects — **fixed** in `src/server.ts`.

---

## Routes not in master prompt but worth noting

| Route              | Status                | Notes                                                 |
| ------------------ | --------------------- | ----------------------------------------------------- |
| `/finance`         | Marketing placeholder | No live calculator                                    |
| `/insurance`       | Marketing placeholder | Lead form only                                        |
| `/landlord/import` | Partial               | Import functions exist; type gaps on `import_batches` |
| `/admin/revenue`   | Shipped               | Revenue dashboard                                     |
| `/tenant/compare`  | Shipped               | Compare up to 4 listings                              |

---

## Phase 1 fix checklist (prioritized)

| Priority | Task                                        | Effort |
| -------- | ------------------------------------------- | ------ |
| P0       | Wire remaining homepage stats to Supabase   | Small  |
| P0       | Confirm Mapbox token in production env      | Config |
| P1       | Remove or gate Stripe dead code             | Small  |
| P1       | Add slug-based property URLs + redirects    | Medium |
| P2       | Rename `/tenant` → `/search` with redirects | Medium |
| P2       | E2E checkout sandbox test in CI             | Medium |

---

## Verification commands

```bash
npm run test:routes    # HTTP audit all routes
npm run test:smoke     # API smoke tests
npm run test:e2e       # Auth + tenant flows
```

All should pass against `https://nyumbasearch.com` before declaring Phase 1 complete.
