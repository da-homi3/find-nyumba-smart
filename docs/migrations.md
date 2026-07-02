# Database migrations

NyumbaSearch uses **Supabase Postgres**, not Cloudflare D1. Run migrations via npm scripts or Supabase dashboard SQL editor.

## Ordered apply sequence (fresh environment)

```bash
cd find-nyumba-smart

# 1. Base Supabase schema (auth, profiles, properties) — via Supabase project migrations
#    Apply any SQL in supabase/migrations/ through Supabase CLI if present.

# 2. Revenue tables (payments, subscriptions, boosts)
npm run db:migrate:push

# 3. Revenue column patches
npm run db:migrate:columns

# 4. Partnership / agency extensions
npm run db:migrate:partnership

# 5. Contact unlock table + columns
npm run db:migrate:contact-unlock

# 6. Platform extensions (import batches, API keys, WhatsApp sessions, marketing log)
npm run db:migrate:platform-extensions

# 7. RLS policies (run in this order)
npm run db:migrate:foundation-rls
npm run db:migrate:rls
npm run db:migrate:revenue-rls
npm run db:migrate:has-role-grant
npm run db:migrate:viewings-booking

# 7. Optional seed data
npm run db:seed:revenue
npm run seed:listings
```

## Rollback

Supabase migrations are forward-only in production. To roll back a CSV import batch, use **Landlord → Bulk import → Rollback** (24h window) or:

```sql
DELETE FROM properties WHERE import_batch_id = '<batch-id>';
```

For revenue import batches:

For script-applied changes, inspect the corresponding `scripts/apply-*-migration.mjs` file for the exact SQL and write a manual reverse migration.

## Local PowerShell

```powershell
npm run migrate:local:ps1
```

## Verify after migrate

```bash
npm run test:smoke
npm run test:routes
```
