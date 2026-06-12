# NyumbaSearch — Bug Report

**Audit date:** 2026-06-12  
**Production URL:** https://nyumba-search.kevinbuluma1.workers.dev  
**Route audit:** 60/60 passed (`route-report.json`)

## Critical (fixed this audit)

| ID | Issue | Root cause | Status |
|----|-------|------------|--------|
| B-01 | `/tenant/compare` returned 404 on production | Route added locally but not deployed | **Fixed** — deployed |
| B-02 | Homepage KPIs derived from full `fetchProperties()` list | Client pulled all listings for two counters | **Fixed** — `getPublicStats` server fn |
| B-03 | Revenue RLS blocked user INSERT/UPDATE | SELECT-only policies on revenue tables | **Fixed** — migration `20260612230000` |
| B-04 | RLS hardening referenced missing `organization_id` on greenfield | Foundation migration gap | **Fixed** — foundation + bridge migration |
| B-05 | Vite tmp artifacts in git | Dev files committed | **Fixed** — removed + `.gitignore` |
| B-06 | CI lint/build used `\|\| true` | Failures ignored | **Fixed** — strict quality job |
| B-07 | No React error boundary around routes | Only TanStack `errorComponent` | **Fixed** — `ErrorBoundary` wrapper |

## High (mitigated / monitored)

| ID | Issue | Notes | Status |
|----|-------|-------|--------|
| B-08 | Search fired API on every keystroke | No debounce | **Fixed** — 400ms debounce |
| B-09 | Auth flash on protected routes | `loading` initial `false` | **Fixed** (prior session) |
| B-10 | Service-role reads for public listings | Security/scale concern | Documented; public client + RLS path exists |
| B-11 | Dynamic property routes with fake UUID | Audit false negatives | **Fixed** — audit uses live listing id |

## Low / open

| ID | Issue | Recommendation |
|----|-------|----------------|
| B-12 | Lighthouse score not yet ≥90 | Run Lighthouse CI on `/` and `/tenant` |
| B-13 | Test coverage ~5% (unit) | Expand Vitest toward 80% on `src/lib` |
| B-14 | Playwright not in default CI | Add `npx playwright install` + `test:playwright` job |
| B-15 | `supabase/.temp/*` tracked in git | Add to `.gitignore` |

## Not reproduced (external audit claims)

- Blank tenant pages on production — **all tenant routes return 200 with SSR body** (4–21 KB)
- Missing `/about`, `/contact` — **present and 200**
