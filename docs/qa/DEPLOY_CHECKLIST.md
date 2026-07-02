# NyumbaSearch — Deploy Checklist

## Pre-deploy

- [ ] `npm run lint` — zero errors
- [ ] `npm run test:unit` — unit tests pass
- [ ] `npm run build` — production build succeeds
- [ ] `npm run test:routes` — 60/60 routes (or review `route-report.json`)
- [ ] `npm run test:smoke` — 42/42 smoke checks
- [ ] Env vars set in Cloudflare (see `wrangler.jsonc` + dashboard secrets)
- [ ] Supabase migrations applied (`npm run db:migrate:rls`, `db:migrate:revenue-rls` as needed)

## Deploy

```bash
cd find-nyumba-smart
npm run deploy
```

Uses Nitro output: `dist/server/wrangler.json` (not root `wrangler.toml` — legacy).

## Post-deploy

- [ ] Hit https://nyumbasearch.com/
- [ ] Verify homepage shows live listing counts (not "0 verified")
- [ ] `/tenant`, `/tenant/map`, `/tenant/compare` return 200
- [ ] Sign-in flow on `/auth`
- [ ] M-Pesa callback endpoint accepts POST (smoke test)
- [ ] Optional: `npm run test:e2e` with test user credentials in `.env`

## Secrets (never commit)

| Variable                    | Purpose                   |
| --------------------------- | ------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes             |
| `SUPABASE_PUBLISHABLE_KEY`  | Client + public reads     |
| `GEMINI_API_KEY`            | NyumbaAI                  |
| `MPESA_*`                   | STK push                  |
| `SENDGRID_API_KEY`          | Email                     |
| `SUPABASE_ACCESS_TOKEN`     | Management API migrations |

## Rollback

```bash
npx wrangler deployments list --config dist/server/wrangler.json
npx wrangler rollback [version-id] --config dist/server/wrangler.json
```

## CI

GitHub Actions: `.github/workflows/ci-deploy.yml`  
On `main`: lint → unit tests → build → route audit artifact → smoke → migrate → deploy (if secrets present).
