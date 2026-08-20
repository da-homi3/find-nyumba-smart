# AGENTS.md

## Cursor Cloud specific instructions

NyumbaSearch is a **single** TanStack Start app (React 19 + Vite + Nitro). The
"backend" is not a separate service — it is server functions (`src/lib/api/*.functions.ts`)
that run inside the same dev server. The only external dependency is **Supabase**
(Postgres + Auth + Storage + Realtime). See `README_BACKEND.md` and `package.json`
scripts for the canonical commands.

### Lint / test / build (no backend needed)
- Lint: `npm run lint`, Unit tests: `npm run test:unit`, Build: `npm run build`.
  These match CI (`.github/workflows/ci-deploy.yml`) and run without Supabase.
- `npm run test:smoke` / `test:e2e` / `test:routes` default their base URL to the
  **deployed prod** site. To run them against the local server, set
  `PUBLIC_APP_URL=http://localhost:8080` first.

### Running the app (requires local Supabase via Docker)
The dev server (`npm run dev`) serves on **http://localhost:8080** (not Vite's default 5173).
Server functions throw if they can't reach Supabase, so a Supabase backend must be running.
This VM uses a **local Supabase CLI stack** (Docker). Per session, services are NOT
auto-started (the update script only runs `npm install`); start them like this:

1. Ensure the Docker daemon is running (it is configured for `fuse-overlayfs` +
   `containerd-snapshotter: false`, required because this is Docker 29 in a Firecracker VM).
   If `docker ps` fails, start it: `sudo bash -c 'nohup dockerd > /var/log/dockerd.log 2>&1 &'`
   then `sudo chmod 666 /var/run/docker.sock`.
2. From the repo root: `supabase start` (prints local API URL + anon/service keys).
3. `npm run dev`.

`.env` is git-ignored and is already populated with the **local** Supabase URL
(`http://127.0.0.1:54321`) and the shared local-dev anon/service keys (these are
public defaults, not real secrets). If `.env` is missing, `cp .env.example .env`
and fill the `SUPABASE_*` values from `supabase start` output.

### Migration caveat (non-obvious)
The SQL files in `supabase/migrations/` are **not idempotent from a clean DB** — a few
re-create existing policies/functions. `supabase start` and `supabase db reset` apply
migrations strictly in a transaction and will **abort** on the first such error
(e.g. `policy "Inquiry participants view messages" ... already exists`). The repo's
intended path (`scripts/run_migrations.sh` / `npm run migrate:local` / CI) uses plain
`psql -f`, which logs those errors but continues. To bootstrap the local schema:

1. Temporarily move `supabase/migrations` aside so `supabase start` brings up a clean
   stack (then move it back), OR start the stack however you like.
2. Apply schema tolerantly:
   `SUPABASE_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' npm run migrate:local`
3. Seed demo listings: `npm run seed:listings` (creates `demo-landlord@nyumbasearch.app`
   and ~8 Nairobi listings; reads `.env`).

If the Docker volume from a previous session persists, the schema + seeded data are
already there and you can skip migration/seed.

### Hello-world flow that exercises core functionality
Sign up a tenant at `/auth?mode=signup` (signups auto-confirm email server-side), land
on `/tenant` listings, open a property, and click **Book viewing** — this writes a row
to `public.viewings`. Optional integrations (M-Pesa, Stripe, SendGrid, Maps, Gemini AI)
degrade gracefully when their keys are absent; payments auto-complete in demo mode.
