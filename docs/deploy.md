# Deployment checklist

Production URL: **https://nyumbasearch.com** (custom domain)  
Fallback: https://nyumba-search.kevinbuluma9-7ff.workers.dev

## Custom domain (nyumbasearch.com)

The domain must exist as a **zone in your Cloudflare account** (`kevinbuluma9@gmail.com`, account ID `7ff77105e5fd9fb5f560d381ec562ed8`).

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Add a site** → `nyumbasearch.com`
2. If nameservers already point to Cloudflare under another account, transfer the zone or deploy from that account.
3. After the zone appears in your account:
   ```bash
   npm run deploy:domain
   ```
4. Update **Supabase** → Authentication → URL Configuration:
   - Site URL: `https://nyumbasearch.com`
   - Redirect URLs: `https://nyumbasearch.com/**`

`scripts/sync-wrangler-env.mjs` sets `PUBLIC_APP_URL`, M-Pesa/Pesapal callbacks, and attaches custom domains when the zone is detected.

## Pre-deploy

- [ ] Copy `.env.example` → `.env` and fill all required values
- [ ] `npm run db:migrate:push` (and other migrations if schema changed)
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:routes`
- [ ] `npm run build`

## Cloudflare secrets (via sync script or dashboard)

The deploy script `scripts/sync-wrangler-env.mjs` uploads these from `.env`:

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SENDGRID_API_KEY`
- [ ] `SENDGRID_FROM_EMAIL`
- [ ] `OPS_NOTIFICATION_EMAIL`
- [ ] `MPESA_CONSUMER_KEY`
- [ ] `MPESA_CONSUMER_SECRET`
- [ ] `MPESA_PASSKEY`
- [ ] `PESAPAL_CONSUMER_KEY`
- [ ] `PESAPAL_CONSUMER_SECRET`
- [ ] `CRON_SECRET`
- [ ] `GEMINI_API_KEY` (optional)
- [ ] `CARETAKER_SESSION_SECRET`

## Plain vars (merged into wrangler.json)

- [ ] `PUBLIC_APP_URL`
- [ ] `MPESA_ENV`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`
- [ ] `PESAPAL_ENV`, `PESAPAL_CALLBACK_URL`
- [ ] `VITE_MAPBOX_TOKEN` / `MAPBOX_PUBLIC_TOKEN`

## Deploy

```bash
npm run deploy
# or manually:
npm run build
node scripts/sync-wrangler-env.mjs
npx wrangler deploy --config dist/server/wrangler.json
```

## Post-deploy smoke tests

- [ ] `npm run test:smoke`
- [ ] Register / login flow
- [ ] M-Pesa sandbox STK push (landlord plan or Plus)
- [ ] Pesapal sandbox card redirect
- [ ] Email appears in SendGrid activity
- [ ] `/tenant/map` renders map or fallback with listing pins
- [ ] `/landlord/checkout?plan=pro` shows checkout form (authenticated)
- [ ] `/landlord/boost?package=spotlight` shows boost wizard
- [ ] `/verify/request` shows multi-step verification form (not `/verify` landing)
- [ ] `/services/register` shows provider signup (not services hub)
- [ ] Homepage trust stats animate (not stuck at 0)
- [ ] `/reports` charts render with live or fallback data

## Git (optional)

Push submodule and parent repo when ready:

```bash
cd find-nyumba-smart && git push origin main
cd .. && git add find-nyumba-smart && git commit -m "Bump find-nyumba-smart" && git push
```
