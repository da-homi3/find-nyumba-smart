# NyumbaSearch — Fix Report

## Summary

Production-readiness pass: route crawler, data wiring, search UX, error handling, tests, and CI hardening.

## Code changes

### Route & data

- `scripts/route-audit.mjs` — crawls 60 routes → `route-report.json`
- `src/lib/api/stats.functions.ts` — `getPublicStats` (active, verified, neighborhoods, views)
- `src/routes/index.tsx` — homepage stats from API with cache
- `src/lib/api/analytics.functions.ts` — `recordSearchEvent` (structured logs + audit row)

### Search & map

- `src/hooks/use-debounced-value.ts` — shared debounce hook
- `src/routes/tenant.index.tsx` — debounced query, search analytics, recently viewed strip
- `src/routes/tenant.compare.tsx` — compare listings UI (`?ids=uuid1,uuid2`)
- `src/lib/recently-viewed.ts` + `src/hooks/use-property-detail.ts` — local recently viewed

### Errors & UX

- `src/components/ErrorBoundary.tsx` — React boundary with retry
- `src/routes/__root.tsx` — wraps `<Outlet />` in boundary
- `src/hooks/use-theme.ts` + `src/routes/settings.tsx` — dark mode toggle

### Database (prior + this session)

- `20260612230000_revenue_rls_writes.sql` — INSERT/UPDATE/DELETE policies
- Foundation `organization_id` on `properties`
- `npm run db:migrate:revenue-rls` applied to production

### Testing & CI

- Vitest: `tests/unit/*.test.ts`, `vitest.config.ts`
- Playwright: `e2e/routes.spec.ts`, `playwright.config.ts`
- `.github/workflows/ci-deploy.yml` — lint, unit tests, build, route audit artifact, smoke

### Cleanup

- Removed tracked `tmp_*` dev artifacts
- Deleted root-level stray `tmp_*.js/html/ts`

## Verification

```bash
npm run test:unit      # 4/4 passed
npm run test:routes    # 60/60 passed
npm run test:smoke     # 42/42 passed
npm run build          # OK
```

## Deploy

Latest deploy includes compare route, stats API, debounced search, error boundary, and theme support.
