# NyumbaSearch — Architecture Report

**Audit date:** 2026-06-11  
**Production URL:** https://nyumbasearch.com  
**Codebase:** `find-nyumba-smart/` (307 TS/TSX/JS source files — see `file-tree.txt`)

---

## Executive summary

NyumbaSearch is a **TanStack Start SSR application** deployed as a **single Cloudflare Worker** (Nitro build). It is **not** the pure React SPA + D1 REST API architecture described in Master Build Prompt v2. The live stack uses **Supabase Postgres** for data, **SendGrid** for email, **Pesapal** for card payments, and **Gemini** for AI — with M-Pesa Daraja as the primary payment rail.

Production route audit: **66/66 routes HTTP 200** with non-empty SSR HTML (`route-report.json`, 2026-06-27).

---

## Stack reality vs Master Prompt v2

| Layer | Master Prompt v2 | **Actual implementation** |
|-------|-------------------|---------------------------|
| Frontend | React 18 SPA | **React 19 + TanStack Router/Start (SSR)** |
| Backend | Cloudflare Workers REST (`app.get/post`) | **TanStack `createServerFn` + Nitro Worker** |
| Database | Cloudflare D1 (SQLite) | **Supabase Postgres** |
| Cache | Cloudflare KV | **Not bound** (in-memory rate limits only) |
| Storage | Cloudflare R2 | **Supabase Storage / external URLs** (no R2 binding in deploy) |
| Email | Resend | **SendGrid** (`@sendgrid/mail`) |
| Card payments | Flutterwave | **Pesapal** |
| AI | Anthropic Claude | **Google Gemini** (`GEMINI_API_KEY`) |
| Auth | Custom JWT | **Supabase Auth** (session cookies + RLS) |
| Deploy | Cloudflare Pages + Workers | **Workers only** via `dist/server/wrangler.json` |

**Implication:** Phase 1+ of the master prompt must be adapted to Supabase/TanStack patterns — not copied as D1/REST/Resend/Flutterwave.

---

## Request flow

```
Browser
  → Cloudflare Worker (src/server.ts)
      → attachRuntimeEnv(env) + security headers
      → TanStack Start server entry (SSR)
          → start.ts middleware:
              1. infrastructure-routes (webhooks, sitemap, /api/v1)
              2. error middleware
          → Route component + createServerFn RPC
              → Supabase (anon or service role)
  → HTML + hydrated React client
```

Infrastructure routes are handled **before** SSR in `src/lib/api/infrastructure-routes.ts` via `tryInfrastructureRoute()`.

---

## Frontend route tree (66 routes)

Generated from `src/routeTree.gen.ts`:

### Public / marketing
| Path | Purpose |
|------|---------|
| `/` | Homepage (3D hero, stats, featured listings) |
| `/about`, `/contact`, `/advertise`, `/pricing` | Marketing |
| `/reports` | Market report charts (live Supabase aggregates + fallbacks) |
| `/finance`, `/insurance` | Partner/marketing funnels |
| `/whatsapp` | WhatsApp bot landing |

### Tenant (demand)
| Path | Purpose |
|------|---------|
| `/tenant` | Search & browse |
| `/tenant/map` | Mapbox 3D / Google Maps fallback |
| `/tenant/property/$id` | Property detail |
| `/tenant/saved`, `/tenant/compare`, `/tenant/profile` | Saved, compare, profile |
| `/tenant/messages`, `/tenant/messages/$id` | Inquiries (Plus-gated send) |
| `/tenant/checkout` | Plus subscription checkout |
| `/tenant/review/$propertyId` | Write review |

### Landlord / agency / manager (supply)
| Path | Purpose |
|------|---------|
| `/landlord/*` | Dashboard, properties, leads, analytics, import, boost, checkout, billing |
| `/agency/*` | Agency portal |
| `/manager/*` | Property manager portal |
| `/caretaker/*` | Caretaker PIN portal |

### Trust & services
| Path | Purpose |
|------|---------|
| `/verify`, `/verify/request`, `/verify/status/$requestId` | Verification marketing + intake + status |
| `/services`, `/services/register`, `/services/$category`, `/services/provider/*` | Service provider marketplace |

### Auth & admin
| Path | Purpose |
|------|---------|
| `/auth`, `/auth/reset`, `/auth/pending` | Sign in/up, password reset, pending approval |
| `/settings` | User preferences |
| `/admin`, `/admin/revenue` | Admin console |

**Not yet implemented (master prompt Phase 2):** `/search`, `/map`, `/property/[slug]`, `/alerts`, `/compare` as top-level paths (compare exists at `/tenant/compare`).

---

## Backend API surface

### A. TanStack Server Functions (`createServerFn`)

Primary API layer — called from React via RPC, not REST paths.

| Module | Key functions |
|--------|---------------|
| `nyumba/nyumba-properties.ts` | `listProperties`, `getProperty`, CRUD, saved, landlord/agency lists |
| `nyumba/nyumba-inquiries.ts` | Inquiry threads, messaging |
| `payment.functions.ts` | `initiatePayment`, `verifyPaymentStatus`, `createVerificationRequest` |
| `contact-unlock.functions.ts` | Trial + paid contact unlock |
| `portal.functions.ts` | Portal applications, role switching |
| `auth.functions.ts` | `registerAccountSignup` |
| `stats.functions.ts` | `getPublicStats`, `getMarketReportTeaser` |
| `verification.functions.ts` | `getVerificationRequest` |
| `caretaker.functions.ts` | Caretaker CRUD + session |
| `admin.functions.ts` | Admin moderation |
| `booking.functions.ts` | Viewing requests |
| `search.functions.ts` | Saved searches |
| `analytics.functions.ts` | Search event recording |
| `import.functions.ts` | Bulk CSV import |
| `service-provider.functions.ts` | Provider signup |
| `revenue.functions.ts` | Subscriptions, leads |
| `trust.functions.ts` | Scam reports |
| `ai.functions.ts` | Valuation, chat |
| `media.functions.ts` | Uploads |

Auth: `requireSupabaseAuth` middleware + `_authz.requireRole()` for RBAC.

### B. Infrastructure HTTP routes (`infrastructure-routes.ts`)

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/mpesa/callback` | M-Pesa STK webhook |
| POST/GET | `/api/payments/webhook/pesapal` | Pesapal IPN |
| GET | `/api/payments/callback/card` | Card redirect return |
| POST | `/api/cron/subscription-renewals` | Renewal cron |
| POST | `/api/cron/daily` | Daily jobs |
| POST | `/api/cron/weekly` | Weekly digest |
| POST | `/api/cron/monthly` | Monthly jobs |
| GET/POST | `/api/whatsapp/webhook` | Meta WhatsApp webhook |
| * | `/api/v1/*` | Integration API (API keys) |
| GET | `/api/health/connections` | Dependency health |
| GET | `/api/ai/probe` | AI connectivity probe |
| GET | `/robots.txt` | SEO robots |
| GET | `/sitemap.xml` | Dynamic sitemap (Supabase listings) |

### C. REST v1 (`/api/v1/`)

Bearer `nsk_*` API keys → listings CRUD for integrations. Rate limit: 100/min in-memory.

---

## Database (Supabase Postgres)

**Not D1.** Tables present in `src/integrations/supabase/types.ts` (35+ tables):

`properties`, `profiles`, `user_roles`, `payments`, `subscriptions`, `contact_unlocks`, `verification_requests`, `service_providers`, `inquiries`, `inquiry_messages`, `saved_properties`, `saved_searches`, `viewings`, `listing_boosts`, `property_reviews`, `scam_reports`, `fraud_signals`, `organizations`, `portal_applications`, `caretakers`, `payment_webhook_log`, `admin_audit_logs`, …

**Missing vs Master Prompt v2:** `referrals`, `search_events`, `property_comparisons`, `viewing_requests` (may overlap with `viewings`), `notifications`, `import_batches` (import may use partial schema), `listings.slug`, soft-delete columns, `whatsapp_sessions`.

Migrations live under `scripts/apply-*.mjs` (not `wrangler d1 execute`).

---

## Cloudflare bindings

Deploy config: `dist/server/wrangler.json` (generated by Nitro build + `scripts/sync-wrangler-env.mjs`).

| Binding | Status |
|---------|--------|
| Worker script | ✅ `worker.mjs` |
| Static assets | ✅ Nitro client bundle |
| D1 | ❌ Not used |
| KV | ❌ Not bound (legacy `wrangler.toml` reference only) |
| R2 | ❌ Not bound |
| Cron triggers | ✅ Patched via `scripts/patch-worker-cron.mjs` |

Account: `7ff77105e5fd9fb5f560d381ec562ed8` (kevinbuluma9@gmail.com)

---

## Environment variables

**Source of truth:** `.env.example` + `scripts/sync-wrangler-env.mjs`

### Vars (non-secret, synced to wrangler)
`PUBLIC_APP_URL`, `SITE_URL`, `MPESA_*`, `PESAPAL_*`, `VITE_MAPBOX_TOKEN`, `GEMINI_MODEL`, …

### Secrets (Worker secrets)
`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, `MPESA_*`, `PESAPAL_*`, `CRON_SECRET`, `GEMINI_API_KEY`, `WHATSAPP_*`, …

### Client-exposed (`VITE_*`)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAPBOX_TOKEN`, `VITE_SITE_URL`, `VITE_PESAPAL_CHECKOUT_ENABLED`, `VITE_WHATSAPP_NUMBER`

**Not in codebase:** `JWT_SECRET`, `RESEND_*`, `FLW_*`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID` (master prompt vars).

---

## External services

| Service | Usage | Config |
|---------|-------|--------|
| Supabase | Auth, Postgres, RLS | `SUPABASE_*` |
| Safaricom Daraja | M-Pesa STK Push | `MPESA_*` |
| Pesapal | Card checkout | `PESAPAL_*` |
| SendGrid | Transactional email | `SENDGRID_*` |
| Mapbox GL | 3D map (primary) | `VITE_MAPBOX_TOKEN` |
| Google Maps | Map fallback | `VITE_GOOGLE_MAPS_API_KEY` |
| Google Gemini | AI valuation/chat | `GEMINI_API_KEY` |
| Meta WhatsApp | Listing bot webhook | `WHATSAPP_*` |
| Stripe | **Legacy/unused in UI** | `src/lib/api/stripe.ts` exists; package in deps but not wired |

---

## Deployment

```bash
npm run build
node scripts/sync-wrangler-env.mjs
npx wrangler deploy --config dist/server/wrangler.json
```

Custom domains: `nyumbasearch.com`, `www.nyumbasearch.com`

---

## Prior spec documents

Master Prompt v2 references `nyumbasearch-*.md` files — **not found in this repository**. Existing QA docs: `docs/qa/BUG_REPORT.md`, `FEATURE_REPORT.md`, `PERFORMANCE_REPORT.md`, `DEPLOY_CHECKLIST.md`.

---

## Recommended architecture decisions before Phase 1

1. **Confirm stack:** Keep Supabase + TanStack Start, or migrate to D1 (major rewrite).
2. **If keeping Supabase:** Map master prompt SQL migrations → Supabase migration scripts.
3. **Deprecate Stripe** dependency or remove dead code.
4. **Add KV binding** if rate limiting and OTP storage must survive Worker cold starts.
5. **Unify domain env:** Production uses `nyumbasearch.com`.
