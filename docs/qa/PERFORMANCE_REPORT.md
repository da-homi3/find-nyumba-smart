# NyumbaSearch — Performance Report

**Target:** Lighthouse >90 (mobile)  
**Status:** Not fully measured in CI yet — recommendations below.

## Wins (implemented or existing)

| Area | Implementation |
|------|----------------|
| Code splitting | TanStack Router file-based lazy routes + Vite chunks |
| Homepage data | `getPublicStats` avoids loading full listing array for KPIs |
| Search | 400ms debounce reduces API churn |
| Query cache | React Query `staleTime` on homepage stats (120s) and listings |
| Map | Viewport culling on heatmap circles; marker clusterer lazy import |
| Images | Hero `fetchPriority="high"`; property cards use listing URLs |
| SSR | TanStack Start SSR on Cloudflare Workers (~4–56 KB HTML per route) |

## Bundle notes

- Largest server chunks: `recharts`, `react-dom`, `@supabase/auth-js` (dashboard analytics)
- Google Maps loaded only on `/tenant/map` via dynamic import
- Consider lazy-loading `recharts` on landlord analytics route only

## Lighthouse action plan

1. Add `npm run lighthouse` script (unlighthouse or `lhci autorun`)
2. Preconnect already present for Google Fonts
3. Add `loading="lazy"` on below-fold property card images
4. Set CDN cache headers — `_headers` in dist/client
5. Audit third-party: Maps, SendGrid (server-only), Gemini (server-only)

## Route payload sample (production audit)

| Route | Body size |
|-------|-----------|
| `/` | ~56 KB |
| `/tenant` | ~21 KB |
| `/tenant/map` | ~13 KB |
| `/tenant/property/$id` | ~6 KB |

No blank-shell routes detected in `route-report.json`.
