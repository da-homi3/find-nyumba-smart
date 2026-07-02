# Remaining risks & limitations

## Spec vs implementation gap

The full platform build prompt describes D1, KV, Resend, Flutterwave, Anthropic, and 11 feature phases. The live codebase uses **Supabase, SendGrid, Pesapal, Workers AI/Gemini**. Migrating storage or payment providers would be a separate project.

## Not fully implemented

| Feature                                    | Risk                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| 27 transactional/marketing email templates | Users may not receive lifecycle emails beyond basic SendGrid notifications |
| WhatsApp listing bot                       | No Meta webhook; agents cannot create listings via WhatsApp                |
| Bulk CSV/XLSX import                       | Landlords must add listings one at a time                                  |
| External REST API (`/api/v1/*`)            | No partner integrations                                                    |
| Saved search email alerts                  | `saved_searches` table may not exist; M-05 cron not wired                  |
| Marketing cron series                      | Re-engagement, digest, price-drop emails not scheduled                     |
| `sitemap.xml`                              | SEO crawl coverage incomplete                                              |
| Error boundaries on every page             | Partial — not all routes wrapped                                           |

## Third-party sandbox differences

- **M-Pesa sandbox** uses shortcode `174379`; production requires live Daraja credentials and callback URL whitelisting.
- **Pesapal sandbox** redirect URLs and IPN timing differ from production.
- **Mapbox** token domain restrictions can block map tiles on new deploy URLs until allowlist updated.
- **SendGrid** sandbox/single-recipient mode may suppress delivery until sender domain verified.

## Performance at scale

- `fetchProperties()` loads full listing set for map/browse — consider pagination/geo queries as inventory grows.
- Mapbox cluster layer rebuilds on every filter change — monitor on low-end mobile devices.
- Supabase connection pooling via Worker — watch concurrent server function invocations during traffic spikes.
- Recharts on `/reports` is client-only; acceptable for teaser page but full reports need server-rendered PDFs or cached aggregates.

## Operational

- `sync-wrangler-env.mjs` requires network access to Cloudflare API; deploy may fail offline — use manual `wrangler secret put`.
- Submodule `find-nyumba-smart` vs parent `nyumbani` repo can drift; always bump submodule pointer after deploy.
- OneDrive sync on Windows can cause file lock issues during `npm run build` — build from non-synced path if errors occur.

## Recommended next priorities

1. Expand SendGrid templates for payment receipts and subscription lifecycle
2. Add auth endpoint rate limiting in Worker middleware
3. Paginate property fetch for map and browse
4. Implement `sitemap.xml` from published listings
5. Add React error boundaries on checkout, map, and admin routes
