# NyumbaSearch — Performance Report

**Audit date:** 2026-06-11  
**Target (spec):** Lighthouse mobile ≥90, initial bundle <250KB gzipped  
**Status:** Not fully measured in CI; production route payloads audited

---

## Production SSR payload (route-report.json)

| Route                  | HTML size | Status      |
| ---------------------- | --------- | ----------- |
| `/`                    | ~59 KB    | ✅ Rich SSR |
| `/tenant`              | ~21 KB    | ✅          |
| `/tenant/map`          | ~13 KB    | ✅          |
| `/tenant/property/$id` | ~6 KB     | ✅          |
| `/pricing`             | ~19 KB    | ✅          |
| `/landlord/checkout`   | ~6 KB     | ✅          |

**No zero-byte or blank-shell routes detected.**

---

## Bundle architecture

**Build:** Vite 7 + TanStack Start + Nitro → Cloudflare Worker

**Manual chunks** (`vite.config.ts`):

- `supabase` — `@supabase/*`
- `tanstack` — `@tanstack/*`

**Chunk size warning limit:** 750 KB (Rollup)

### Heavy dependencies (lazy-load status)

| Package                     | Size impact | Load strategy                                 |
| --------------------------- | ----------- | --------------------------------------------- |
| `mapbox-gl`                 | Large       | ✅ SSR external; dynamic import on map routes |
| `three`                     | Large       | Homepage hero — verify lazy boundary          |
| `recharts`                  | Medium      | ✅ Client-only mount wrapper on `/reports`    |
| `framer-motion`             | Medium      | Used widely — acceptable                      |
| `gsap`                      | Medium      | Landing animations                            |
| `@googlemaps/js-api-loader` | Medium      | Fallback on `/tenant/map` only                |
| `@supabase/supabase-js`     | Medium      | Core — chunked                                |
| `stripe`                    | Medium      | ⚠️ **Unused** — remove from deps              |
| `lottie-react`              | Medium      | Spot usage                                    |

**Recommendation:** Run `npm run build` + analyze with `rollup-plugin-visualizer` or `vite-bundle-visualizer` — not yet in CI.

---

## Code splitting

| Pattern                    | Status                                      |
| -------------------------- | ------------------------------------------- |
| TanStack file-based routes | ✅ Automatic route chunks                   |
| `LazyRadar`                | ✅ Dynamic import for WebGL radar           |
| Google Maps                | ✅ Dynamic on map page                      |
| Mapbox                     | ✅ Hook-based lazy init                     |
| Recharts on reports        | ✅ `ClientChart` mount gate                 |
| Landlord analytics charts  | ⚠️ May eager-load recharts — lazy recommend |

---

## Data fetching performance

| Area                   | Implementation                   | Notes                            |
| ---------------------- | -------------------------------- | -------------------------------- |
| Homepage listings      | `fetchProperties({ limit: 50 })` | ✅ Capped                        |
| Homepage stats         | `getPublicStats()` server fn     | ✅ Avoids full listing pull      |
| Search debounce        | 400ms                            | ✅ Reduces API churn             |
| React Query staleTime  | 60–120s on homepage              | ✅                               |
| Map properties         | 500 limit                        | ⚠️ Consider viewport-based fetch |
| Public stats views sum | Limited to 500 rows              | ⚠️ Approximate total             |

---

## Caching

| Layer                             | Status                                |
| --------------------------------- | ------------------------------------- |
| Cloudflare CDN                    | Default Worker caching                |
| KV cache (spec: hood list, stats) | ❌ Not implemented                    |
| API response cache headers        | Partial via `_headers` in client dist |
| Supabase query cache              | Client-side React Query only          |

**Recommendation:** Cache `getPublicStats` and neighborhood list in KV (1h TTL) per spec §11.3.

---

## Images

| Pattern                          | Status                                         |
| -------------------------------- | ---------------------------------------------- |
| Hero `fetchPriority="high"`      | ✅ (per prior QA doc)                          |
| Listing cards `loading="lazy"`   | ⚠️ Audit all `PropertyCard` images             |
| Image CDN / R2 transforms        | ❌ Direct URLs                                 |
| Client-side resize before upload | Spec requirement — verify `media.functions.ts` |

---

## Database query performance

**Engine:** Supabase Postgres (not D1)

| Query                            | Concern                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `listProperties` with filters    | Depends on indexes on `neighborhood`, `rent`, `is_active` |
| `getPublicStats` multiple counts | OK with head-only counts                                  |
| Full property select on list     | Mitigated by `PUBLIC_PROPERTY_COLUMNS`                    |
| Missing `search_events` table    | N/A until Phase 8                                         |

**Action:** Run `EXPLAIN ANALYZE` on hot paths in Supabase dashboard for production-like data volume.

---

## Map / 3D performance

| Component         | Notes                                    |
| ----------------- | ---------------------------------------- |
| Mapbox 3D terrain | GPU-intensive; only on map route ✅      |
| Radar WebGL       | Used as loading placeholder — reasonable |
| Heatmap layer     | Viewport culling noted in prior QA       |
| Marker clusterer  | Lazy import ✅                           |

---

## Core Web Vitals (estimated)

**Not measured in this audit.** Prior doc target: Lighthouse ≥90.

### Likely LCP contributors

- Homepage hero image (`hero-nairobi.jpg`)
- Font loading (Google Fonts preconnect mentioned in QA)
- SSR HTML size ~59KB on `/` — acceptable

### Likely TBT contributors

- Three.js hero if not deferred
- Framer Motion on landing sections

### Action plan

1. Add Lighthouse CI (`lhci autorun`) on `/` and `/tenant`
2. `loading="lazy"` on below-fold property images
3. Defer Three.js hero until `requestIdleCallback` or intersection observer
4. Remove unused `stripe` dependency
5. Lazy-load `recharts` on landlord analytics route
6. Preconnect to Supabase and Mapbox origins
7. Verify `dist/client/_headers` Cache-Control for static assets

---

## Worker cold start

Single Nitro Worker bundle includes SSR + server functions. **Large worker bundle increases cold start.**

Mitigations already in place:

- External `mapbox-gl`, `@sendgrid/mail` in SSR config
- Infrastructure routes short-circuit before full SSR

**Recommendation:** Monitor Cloudflare Workers analytics for p99 latency; consider splitting cron to separate worker if needed.

---

## Performance debt summary

| Priority | Item                       | Effort |
| -------- | -------------------------- | ------ |
| P1       | Bundle analysis in CI      | Small  |
| P1       | Remove stripe dep          | Small  |
| P2       | KV cache for public stats  | Medium |
| P2       | Lazy recharts on analytics | Small  |
| P2       | Image lazy loading audit   | Small  |
| P3       | Lighthouse CI gate         | Medium |
| P3       | Viewport-based map fetch   | Medium |

---

## Verification commands

```bash
npm run build
# Optional: npx vite-bundle-visualizer or rollup-plugin-visualizer

npm run test:routes   # SSR payload sizes
npm run preview       # Local Lighthouse
```

Compare against targets after Phase 11 hardening.
