# Security audit artifacts

Generated during Phase 1 security hardening. Re-run:

```powershell
rg -n --glob "*.ts" --glob "*.tsx" --glob "*.js" -E "(api[_-]?key|secret|password|token|AUTH|BEARER|sk_|pk_)" . | rg -v "node_modules|process\.env|import\.meta\.env" > docs/audit/hardcoded-secrets.txt
rg -n "VITE_" src --glob "*.ts" --glob "*.tsx" > docs/audit/public-vars.txt
```

## Rules enforced

- Secrets live in Cloudflare Worker secrets / `.env` only — synced via `scripts/sync-wrangler-env.mjs`
- `VITE_*` vars are public (Supabase anon key, Mapbox token, app URL)
- Role assignment is server-side via `user_roles` + portal application review — never from URL `role=`
- Supabase parameterized queries (no raw SQL interpolation)
- Neighborhood filters whitelist in `src/lib/security/neighborhoods.ts`
