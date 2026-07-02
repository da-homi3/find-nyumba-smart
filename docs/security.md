# Security audit notes

Review date: June 2026. Scope: NyumbaSearch `find-nyumba-smart` codebase.

## Strengths

- Payment fulfillment gated on `payments.status === 'completed'` in `fulfill-payment.ts`
- Card checkout requires server-side `verifyPaymentStatus` before success UI
- Demo M-Pesa blocked in production unless `ALLOW_DEMO_PAYMENTS=true`
- Supabase RLS on tenant-facing tables; Worker uses service role only server-side
- Optional `MPESA_WEBHOOK_SECRET` for callback verification
- Cron endpoints protected by `CRON_SECRET`
- Caretaker sessions use signed tokens (`CARETAKER_SESSION_SECRET`)

## Concerns & recommendations

| Severity | Issue                                                   | Location                    | Recommendation                                                                    |
| -------- | ------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| Medium   | Service role key in Worker env                          | Cloudflare secrets          | Rotate periodically; never log; restrict Worker access                            |
| Medium   | SendGrid from-address fallback                          | `notify.ts`                 | Set `SENDGRID_FROM_EMAIL` in production; verify domain in SendGrid                |
| Medium   | No rate limiting on auth endpoints                      | Supabase Auth               | Enable Supabase rate limits; add Worker IP throttling for custom auth routes      |
| Low      | `wrangler.jsonc` contains publishable Supabase anon key | `wrangler.jsonc`            | Anon key is public by design; ensure RLS is tight                                 |
| Low      | CORS not explicitly configured in Worker                | `src/server.ts`             | Nitro/Cloudflare defaults may suffice; add explicit origin allowlist for `/api/*` |
| Low      | HTML sanitization                                       | User-generated listing text | Audit insert paths; strip HTML on server before DB write                          |
| Info     | Legacy JWT prototype in old wrangler.toml               | `wrangler.toml`             | Do not use; remove or add deprecation banner (already commented)                  |
| Info     | `.env` in git status (untracked)                        | workspace                   | Ensure `.gitignore` covers `.env` — never commit secrets                          |

## Admin routes

Admin pages under `/admin/*` should verify `user_roles.role = 'admin'` via server functions. Audit each `admin.*.tsx` route loader before exposing sensitive operations.

## Payment webhooks

- M-Pesa: validate callback origin and optional HMAC secret
- Pesapal: verify IPN signature with consumer secret
- Never trust client-reported payment success without DB row confirmation

## Client secrets

These must **never** appear in `VITE_*` or client bundles:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SENDGRID_API_KEY`
- `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`
- `PESAPAL_CONSUMER_SECRET`
- `CRON_SECRET`, `CARETAKER_SESSION_SECRET`
- `GEMINI_API_KEY`

Safe in client: `VITE_MAPBOX_TOKEN`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PESAPAL_CHECKOUT_ENABLED`
