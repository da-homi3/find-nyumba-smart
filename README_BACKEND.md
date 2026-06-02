# Backend & Database Setup

This project uses Supabase for authentication and Postgres database. The repository already contains SQL migrations under `supabase/migrations` and server functions in `src/lib/api`.

Prerequisites
- Node.js (18+ recommended)
- `supabase` CLI (optional but recommended)
- `pnpm`/`npm` for running scripts

1) Add environment variables
Copy `.env.example` to `.env` and fill in your Supabase project values.

2) Install dependencies
```bash
npm install
```

3) Apply migrations to your Supabase project
Using the Supabase CLI (recommended):
```bash
supabase login
export SUPABASE_PROJECT_REF=your-project-ref
supabase db remote set --project-ref $SUPABASE_PROJECT_REF
supabase db push --project-ref $SUPABASE_PROJECT_REF
```

If you prefer to run the SQL directly against the database, use psql with your Supabase Postgres connection string and apply the files in `supabase/migrations` in order.

4) Local server & admin client
- The app uses an admin Supabase client for server-side operations. Set `SUPABASE_SERVICE_ROLE_KEY` in your environment before running server functions.

Run dev server:
```bash
npm run dev
```

CI / GitHub Actions
- A GitHub Actions workflow is provided at `.github/workflows/ci-deploy.yml` to run migrations and optionally deploy the app.

Required repository secrets for full CI flow
- `SUPABASE_DB_URL` — Postgres connection string for your Supabase database (used to run migrations). Example: `postgres://user:pass@db.host:5432/postgres`.
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (store as secret for runtime use by server).
- `SUPABASE_PROJECT_REF` — Supabase project ref (optional, used in some workflows).
- `WRANGLER_API_TOKEN` — Cloudflare/Wrangler API token to allow deployment (optional).
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account id for Wrangler (optional).

CI behavior
- On push, the workflow installs dependencies and attempts a build.
- If `SUPABASE_DB_URL` is present, the workflow applies each `.sql` file in `supabase/migrations` (in alphabetical order).
- If `WRANGLER_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist, the workflow will build and attempt to publish via `wrangler`.

Manual CI run
- You can trigger the workflow manually from the Actions tab in GitHub because the workflow supports `workflow_dispatch`.

Run migrations locally
1. Ensure `psql` is installed and `SUPABASE_DB_URL` is set:

```powershell
$env:SUPABASE_DB_URL='postgres://user:pass@host:5432/postgres'
npm run migrate:local:ps1
```

Or on macOS/Linux:

```bash
export SUPABASE_DB_URL='postgres://user:pass@host:5432/postgres'
npm run migrate:local
```

Local scripts:
- `scripts/run_migrations.sh` — POSIX shell script to apply `.sql` migrations via `psql`.
- `scripts/run_migrations.ps1` — PowerShell equivalent for Windows.

Security notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` and database connection strings secret. The workflow only uses secrets stored in GitHub Actions and will not echo secret values.

5) Testing endpoints
- The server functions are in `src/lib/api/nyumba.functions.ts`. You can call them from the app or write integration tests that use `supabaseAdmin` from `src/integrations/supabase/client.server.ts`.

6) Deploy
- The repo includes a `deploy` script (build + wrangler deploy). Ensure your deployment secrets (Wrangler, Supabase keys) are configured in your deployment provider.

Notes
- Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` to clients. Only use it server-side.
- Row-level security (RLS) is enabled in migrations; ensure users and roles are configured correctly in Supabase.
