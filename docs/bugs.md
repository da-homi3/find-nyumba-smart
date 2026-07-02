# Pre-existing issues found during codebase scan

Issues from the platform build audit. Status reflects fixes in this session unless noted.

| Route / area                      | File                                        | Issue                                                                                                                   | Status                                                       |
| --------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/landlord/checkout?plan=*`       | `src/routes/landlord.tsx`                   | Parent layout required `isLandlord` before rendering checkout — unauthenticated or non-landlord users saw blank spinner | **Fixed** — payment routes bypass role guard                 |
| `/landlord/boost?package=*`       | `src/routes/landlord.boost.tsx`             | Same layout guard; `onSuccess` was no-op; deep links with `package`+`propertyId` did not skip to payment                | **Fixed**                                                    |
| `/tenant/checkout?plan=plus`      | `src/routes/tenant.checkout.tsx`            | Only nav visible when auth loading returned null briefly                                                                | **Mitigated** — auth loading flash reduced in `use-auth.tsx` |
| `/verify/request`                 | `src/routes/verify.request.tsx`             | Reported as duplicate of `/verify` — code shows distinct multi-step form                                                | **Verified OK** — may have been stale deploy                 |
| `/tenant/map`                     | `src/routes/tenant.map.tsx`                 | Blank when Mapbox token missing or map init hung                                                                        | **Mitigated** — 12s timeout falls back to `FallbackMap`      |
| `/services/register`              | `src/routes/services.register.tsx`          | Previously duplicated services hub                                                                                      | **Fixed in prior session** (fc44962)                         |
| `/reports`                        | `src/routes/reports.tsx`                    | Charts used static mock data; Recharts SSR could render empty                                                           | **Fixed** — live Supabase aggregates + client-only charts    |
| Homepage stats                    | `src/components/motion/AnimatedStat.tsx`    | MotionValue as React child showed `0 / 0% / 0h / 0.0★`                                                                  | **Fixed** — animate with `onUpdate` state                    |
| Auth flash                        | `src/hooks/use-auth.tsx`                    | Every auth event set `loading=true` causing protected route flash                                                       | **Fixed** — only INITIAL_SESSION / SIGNED_IN / SIGNED_OUT    |
| Card checkout bypass              | `src/components/checkout/CheckoutFlow.tsx`  | Pesapal success without payment verification                                                                            | **Fixed in prior session**                                   |
| Demo M-Pesa in production         | `src/lib/payments/initiate-payment-core.ts` | Demo payments could complete without real STK                                                                           | **Fixed in prior session**                                   |
| Services provider route collision | `src/routes/services.provider.$id.tsx`      | `/services/provider` without id broke                                                                                   | **Fixed in prior session**                                   |
| Boost page empty success          | `src/routes/landlord.boost.tsx:60`          | `onSuccess={() => {}}`                                                                                                  | **Fixed**                                                    |
| Legacy wrangler.toml              | `wrangler.toml`                             | References D1/KV prototype — confusing for new contributors                                                             | **Documented** in architecture.md                            |
| Full platform prompt spec         | N/A                                         | Spec assumes D1/KV/Resend/Flutterwave — not current stack                                                               | **Out of scope** — docs reflect Supabase/Pesapal/SendGrid    |

## Remaining known gaps

| Area                          | Description                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Email templates               | Spec lists 27 Resend templates; app uses SendGrid with minimal templates in `notify.ts` |
| WhatsApp bot                  | Not implemented                                                                         |
| Bulk CSV import               | Not implemented                                                                         |
| External REST API `/api/v1/*` | Not implemented                                                                         |
| Marketing email cron series   | Not implemented                                                                         |
| `sitemap.xml` endpoint        | Not verified                                                                            |
