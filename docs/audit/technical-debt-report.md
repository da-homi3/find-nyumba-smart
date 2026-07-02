# NyumbaSearch — Technical Debt Report

**Audit date:** 2026-06-11  
**Scope:** `find-nyumba-smart/` full codebase (307 source files)

---

## Summary

The codebase is a **mature TanStack Start monolith** with substantial feature coverage. Debt clusters around: (1) stack mismatch with greenfield spec docs, (2) in-memory rate limiting, (3) partial error boundaries, (4) legacy/unused payment code, and (5) incomplete schema for Phase 4–10 features.

---

## Critical debt

| ID | Area | Issue | Impact | Recommendation |
|----|------|-------|--------|----------------|
| TD-01 | Architecture | Master prompt assumes D1/REST/Resend/Flutterwave; app uses Supabase/ServerFn/SendGrid/Pesapal | Wrong migrations/API patterns if spec followed literally | Treat master prompt as product spec; adapt implementation layer |
| TD-02 | Database types | `import.functions.ts` references tables/columns missing from generated Supabase types | TypeScript errors; import feature fragile | Run type regen + apply platform-extensions migration |
| TD-03 | Rate limiting | `rate-limit.ts` uses in-memory `Map` | Resets on Worker isolate restart; not shared across instances | Bind Cloudflare KV or Durable Object counter |
| TD-04 | Stripe | `stripe` package + `src/lib/api/stripe.ts` present but unused in payment flow | Confusion, bundle bloat | Remove or document as deprecated |

---

## Duplicated logic

| Pattern | Locations | Notes |
|---------|-----------|-------|
| Phone extraction from user | `landlord.checkout.tsx`, `tenant.checkout.tsx`, `verify.request.tsx`, `landlord.boost.tsx` | Extract shared `profilePhone(user)` helper |
| Plan/checkout line item building | Multiple checkout routes | Could unify behind checkout config factory |
| Supabase admin vs public client | `public-client.ts`, `client.server.ts`, inline imports | Generally OK; some routes still use service role for public reads |
| Map providers | Mapbox hook + Google hook + FallbackMap | Intentional fallback chain; document env requirements |
| Payment initiation | `payment.functions.ts` → `initiate-payment-core.ts` | Good separation — keep |

---

## Dead / legacy code

| Item | Location | Action |
|------|----------|--------|
| `wrangler.toml` (root) | Marked LEGACY | Keep as reference or delete to avoid confusion |
| Stripe integration | `src/lib/api/stripe.ts`, `package.json` stripe dep | Remove if Pesapal-only is final |
| `example.functions.ts` | `src/lib/api/` | Delete if unused |
| `use-stripe-checkout-return.ts` | Deleted in prior session | ✅ |
| Mock listings | `NYUMBA_USE_MOCK_LISTINGS`, `mockListings.ts` | Gate behind dev flag only |
| Paystack webhook path alias | `infrastructure-routes.ts` | Legacy alias for Pesapal |

---

## Missing error boundaries

| Coverage | Status |
|----------|--------|
| `RouteErrorBoundary` | Used on checkout, map, tenant checkout, admin |
| Global TanStack `errorComponent` | Via `__root` route |
| Page-level on all routes | **Incomplete** — many routes lack explicit boundary |
| Worker API errors | Structured in v1 router; server fns throw to middleware |

**Recommendation:** Wrap portal shells (`LandlordShell`, `PublicPageShell` children) with `ErrorBoundary` consistently.

---

## API error handling gaps

| Area | Gap |
|------|-----|
| WhatsApp webhook | No Meta signature verification on POST body (verify token on GET only) |
| Some server fns | Raw Supabase errors bubble to client |
| Infrastructure routes | Generic 500 for unhandled errors |
| Client fetch | React Query handles most; inconsistent toast patterns |

---

## Auth bypass risks (mitigated in prior audit)

| Issue | Status |
|-------|--------|
| Landlord checkout without auth | **Fixed** — redirect + `assertPaymentAuthorization()` |
| Boost purchase for others' listings | **Fixed** — owner check in initiate + fulfill |
| Open redirect on auth | **Fixed** — `isSafeRedirectPath()` |
| Verification request email spoofing | **Fixed** — requires session email match |

---

## Database / query debt

| Issue | Detail |
|-------|--------|
| Full table scans | `getPublicStats` views sum limited to 500 rows |
| Missing indexes (spec) | `search_events`, slug lookups not applicable until tables/columns exist |
| No soft delete | `deleted_at` columns from spec not migrated |
| Slug column | Properties use UUID URLs only |
| Referral system | Not in schema |

---

## Hardcoded values → env vars

| Value | Location | Should be |
|-------|----------|-----------|
| Trust strip defaults (98%, 24h, 4.7★) | `LandingBrowseSections.tsx` | API-driven |
| Fallback rent chart data | `stats.functions.ts` | OK as fallback; label in UI |
| OPS email fallback | `notify.ts` → personal gmail | `OPS_NOTIFICATION_EMAIL` required in prod |
| Demo payments | `ALLOW_DEMO_PAYMENTS`, sandbox logic | Must stay `false` in production |
| Cloudflare account ID | `sync-wrangler-env.mjs` | OK as default for team |

---

## Test coverage debt

| Suite | Status |
|-------|--------|
| Unit (Vitest) | ~5% — unlock pricing, authz, format helpers |
| Route audit | ✅ 66 routes |
| Smoke tests | ✅ 43 checks |
| Playwright | Exists; not in default CI |
| Lighthouse | Not automated |

---

## Documentation debt

| Expected (master prompt) | Status |
|--------------------------|--------|
| `docs/audit/*` | ✅ This audit |
| `docs/architecture.md` | ❌ Not created |
| `docs/database.md` | ❌ Not created |
| `docs/deploy.md` | Partial — `docs/qa/DEPLOY_CHECKLIST.md` |
| `nyumbasearch-*.md` specs | ❌ Not in repo |

---

## Deferred vs resolved

### Resolved (prior sessions)
- SSR 500 / blank pages
- Revenue RLS policies
- Checkout route wiring
- SonarQube warnings (12)
- Portal payment authorization
- M-Pesa webhook fail-closed reverted for sandbox compatibility

### Deferred (Phase 2+)
- Route rename (`/search`, `/map`, `/property/[slug]`)
- Referral system
- Fraud detection module
- Notifications table + bell UI
- Semantic query parser
- Nairobi amenities JSON
- Resend migration (if ever required)
- D1 migration (if ever required)

---

## Priority remediation order

1. Complete homepage stats API (small, high visibility)
2. Apply `db:migrate:platform-extensions` + regen types
3. KV-backed rate limiting
4. WhatsApp POST signature verification
5. Remove Stripe dead code
6. Expand ErrorBoundary coverage
7. Playwright in CI
