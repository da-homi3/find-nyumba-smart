# AGENTS.md

## Cursor Cloud specific instructions

### Service overview
This repo is a **single full-stack web app** ("NyumbaSearch", a Nairobi rental marketplace):
React 19 + TanStack Start (SSR) + Vite, server functions in `src/lib/api/*.functions.ts`,
backed by a **hosted Supabase** project (Postgres + Auth + Storage). Deploy target is
Cloudflare Workers (Wrangler), but local dev is just the Vite dev server.

### Run / lint / test / build
Commands live in `package.json` scripts — use those as the source of truth:
- Dev server: `npm run dev` → Vite serves on **http://localhost:8080** (not 5173). Start it
  in a tmux session so it persists.
- Lint: `npm run lint` (ESLint flat config). NOTE: the existing source currently has many
  pre-existing `prettier/prettier` and `@typescript-eslint/no-explicit-any` violations, so
  `npm run lint` exits non-zero on a clean checkout. `npm run format` (Prettier) can auto-fix
  the formatting ones. Treat lint failures as pre-existing unless you touched the file.
- Tests: run with **Bun** — `bun test` (the single test in `tests/` imports `bun:test`; there
  is no npm `test` script and no vitest/jest). Bun is pre-installed on the VM under `~/.bun`
  and on PATH via `~/.bashrc`; in a non-login shell run `export PATH="$HOME/.bun/bin:$PATH"`
  first.
- Build: `npm run build` (Vite + Nitro/Cloudflare output). `npm run deploy` is build + wrangler.

### Supabase credentials gotcha (IMPORTANT)
Environment variables come from the committed `/workspace/.env`. There is a **project
mismatch** in it: `SUPABASE_URL` / the publishable (anon) key point at project
`uipwedxfkxsabkivvyjr`, but `SUPABASE_SERVICE_ROLE_KEY` is a JWT for a *different* project
(`fnycwcbxorhreidhbers`) and returns **HTTP 401 "Invalid API key"** against the real project.

Consequence: **every server function uses the admin (service-role) client**
(`src/integrations/supabase/client.server.ts`), so all property data flows fail silently —
property browse/search (`listProperties`), property detail, save-property, landlord listings,
dashboard, inquiries all come back empty even though the database is populated and readable
via the anon key. The tenant browse page showing "0 results" is this bug, not an empty DB.

To exercise those data flows, set a **valid `SUPABASE_SERVICE_ROLE_KEY` for project
`uipwedxfkxsabkivvyjr`** (via Secrets) so it overrides the broken value in `.env`.

### Auth behavior (verified live)
- Email confirmation is **OFF**: `supabase.auth.signUp(...)` returns a session immediately and
  the user is logged in (redirects to `/tenant`). Sign-up uses the client-side anon key, so the
  auth/onboarding flow works regardless of the service-role-key issue above.
- The `handle_new_user` DB trigger **hardcodes the `tenant` role** for security; the `role`
  passed in signup metadata is ignored. Landlord/admin access requires a manual role upgrade in
  `public.user_roles` using the service role (so landlord dashboard/listing creation can't be
  reached by self-signup alone).
- Supabase passwords must be strong (leaked-password protection is on) — use a long random one.
