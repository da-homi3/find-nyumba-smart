# NyumbaSearch — Security Report

**Audit date:** 2026-06-11  
**Production:** https://nyumbasearch.com  
**Auditor role:** Security review against Master Prompt §11.1 + codebase inspection

---

## Executive summary

Authentication is **Supabase-managed** (not custom JWT). Payment and portal authorization received **recent hardening**. Main gaps: **in-memory rate limits**, **optional M-Pesa webhook HMAC**, **WhatsApp POST signature not verified**, **Stripe dead code in deps**, and **service-role usage on some public reads**.

**No critical unauthenticated payment bypass found** in current code (post prior audit fixes).

---

## Authentication & authorization

| Control            | Implementation                                               | Status              |
| ------------------ | ------------------------------------------------------------ | ------------------- |
| User auth          | Supabase Auth + `requireSupabaseAuth` middleware             | ✅                  |
| Custom JWT         | Not used                                                     | N/A (spec mismatch) |
| RBAC               | `_authz.requireRole()` on privileged server fns              | ✅                  |
| Portal guards      | `portal-guard.ts`, `landlord.tsx` layout checks              | ✅                  |
| Payment auth       | `assertPaymentAuthorization()` in `initiate-payment-core.ts` | ✅                  |
| Fulfillment auth   | Owner checks in `fulfill-payment.ts`                         | ✅                  |
| Open redirects     | `isSafeRedirectPath()` blocks `//` and external URLs         | ✅                  |
| Caretaker sessions | HMAC session; **throws if secret unset in production**       | ✅                  |

---

## API route auth matrix

### TanStack Server Functions

- **Protected:** Payments, portal admin, property mutations, contact unlock, messaging send
- **Public:** `listProperties`, `getProperty`, `getPublicStats`, `getMarketReportTeaser`
- **Risk:** Public listing reads use service role in some paths — relies on RLS + column selection; prefer anon client where possible

### Infrastructure HTTP routes

| Route                           | Auth                                        | Notes                                                                |
| ------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `/api/mpesa/callback`           | Optional HMAC (`MPESA_WEBHOOK_SECRET`)      | **Fails open if secret unset** — allows sandbox; set secret for live |
| `/api/payments/webhook/pesapal` | Pesapal IPN validation via API status check | ✅                                                                   |
| `/api/cron/*`                   | `CRON_SECRET` header                        | ✅ when secret set                                                   |
| `/api/whatsapp/webhook` GET     | Verify token match                          | ✅                                                                   |
| `/api/whatsapp/webhook` POST    | **No signature check observed**             | ⚠️ High — add `X-Hub-Signature-256` validation                       |
| `/api/v1/*`                     | Bearer API key (`nsk_`)                     | ✅                                                                   |
| `/api/health/connections`       | None                                        | ⚠️ Low — info disclosure; restrict in prod                           |
| `/api/ai/probe`                 | None                                        | ⚠️ Low — disable or protect in prod                                  |

---

## Secrets & exposure

| Secret                          | Exposure risk                | Status                         |
| ------------------------------- | ---------------------------- | ------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`     | Worker secret only           | ✅ Not in client bundle        |
| `SENDGRID_API_KEY`              | Server only                  | ✅                             |
| `MPESA_CONSUMER_SECRET`         | Server only                  | ✅                             |
| `GEMINI_API_KEY`                | Server only                  | ✅                             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public by design             | ✅ Expected                    |
| `VITE_MAPBOX_TOKEN`             | Public by design             | ✅ Mapbox public token pattern |
| `STRIPE_SECRET_KEY`             | Would be server-only if used | ⚠️ Dead code path              |
| `.env` in git                   | `.env` untracked             | ✅ Verify `.gitignore`         |

**Never use `VITE_` for:** service role, M-Pesa secrets, SendGrid, cron secrets.

---

## Input sanitization

| Layer                           | Status                                             |
| ------------------------------- | -------------------------------------------------- | --- |
| Zod validators on server fns    | ✅ Widespread                                      |
| `sanitizeText()` utility (spec) | ❌ Not implemented globally                        |
| Rich text listing descriptions  | ⚠️ Verify XSS on render (React escapes by default) |
| SQL injection                   | Supabase parameterized queries                     | ✅  |

**Recommendation:** Add `sanitizeText()` for user strings before insert; truncate to column max lengths.

---

## CORS

TanStack Start same-origin model — browser calls same Worker domain. **No explicit CORS middleware** for `/api/v1` — third-party integrations use server-to-server Bearer tokens (no browser CORS needed).

If exposing REST publicly later, restrict `Origin` to `PUBLIC_APP_URL`.

---

## Rate limiting

| Endpoint    | Limit           | Storage   |
| ----------- | --------------- | --------- |
| Signup      | 5/min           | In-memory |
| Payments    | 20/min per user | In-memory |
| General API | 120/min         | In-memory |
| v1 API keys | 100/min         | In-memory |

**Risk:** In-memory limits ineffective under multi-isolate Workers load. **Recommendation:** Cloudflare KV or WAF rate rules.

---

## Webhook signature verification

| Provider | Verified | Detail                               |
| -------- | -------- | ------------------------------------ |
| M-Pesa   | Partial  | HMAC when `MPESA_WEBHOOK_SECRET` set |
| Pesapal  | Yes      | Status re-query via API              |
| WhatsApp | GET only | **POST body not signature-verified** |
| Stripe   | N/A      | Not in use                           |

---

## Security headers

Applied in `src/server.ts` via `withSecurityHeaders()`:

- `X-Content-Type-Options: nosniff` ✅
- `X-Frame-Options: DENY` ✅
- `Referrer-Policy: strict-origin-when-cross-origin` ✅

**Missing vs spec:**

- `Permissions-Policy: geolocation=(), camera=(), microphone=()` ❌
- CSP (Content-Security-Policy) ❌

Client static headers may exist in `dist/client/_headers` — verify after build.

---

## Payment security

| Check                               | Status                             |
| ----------------------------------- | ---------------------------------- |
| Idempotency keys on checkout        | ✅ `CheckoutFlow` UUID ref         |
| User can only pay for own boosts    | ✅                                 |
| Demo payment completion gated       | ✅ `ALLOW_DEMO_PAYMENTS` / sandbox |
| Card redirect validates payment row | ✅ Pesapal status sync             |
| Contact unlock before phone reveal  | ✅                                 |

---

## Data access (RLS)

Supabase Row Level Security policies applied via migration scripts (`apply-*-rls.mjs`). Revenue tables had prior SELECT-only gap — **fixed** per BUG_REPORT B-03.

**Admin operations** use service role intentionally — ensure all admin server fns call `requireRole('admin')`.

---

## Findings summary

| Severity | ID     | Finding                                      | Fix                                    |
| -------- | ------ | -------------------------------------------- | -------------------------------------- |
| High     | SEC-01 | WhatsApp POST without signature verification | Implement Meta HMAC validation         |
| High     | SEC-02 | M-Pesa webhook fails open without secret     | Set `MPESA_WEBHOOK_SECRET` before live |
| Medium   | SEC-03 | In-memory rate limits                        | KV-backed counters                     |
| Medium   | SEC-04 | `/api/health/connections` public             | Auth or remove in prod                 |
| Medium   | SEC-05 | No global input sanitization helper          | Add `sanitizeText()`                   |
| Low      | SEC-06 | Missing Permissions-Policy header            | Add to `withSecurityHeaders`           |
| Low      | SEC-07 | Stripe unused dependency                     | Remove                                 |
| Info     | SEC-08 | Spec JWT/CORS patterns don't apply           | Document Supabase auth model           |

---

## Pre-production checklist

- [ ] `MPESA_WEBHOOK_SECRET` set in Worker secrets
- [ ] `CRON_SECRET` set and rotated
- [ ] `CARETAKER_SESSION_SECRET` set (32+ bytes)
- [ ] `ALLOW_DEMO_PAYMENTS=false`
- [ ] WhatsApp signature verification implemented
- [ ] WAF rate limiting on `/auth` and payment endpoints
- [ ] Review service-role usage on public read paths
