# Nyumba Search — Production-Readiness Roadmap

A single mega-PR would be unshippable and unreviewable. I'll execute the scope in **6 phases**, each independently usable. Existing branding (emerald + gold tokens, display font), routes, RLS, and the tenant/landlord split are preserved throughout.

## Guiding principles

- Refactor existing files; do not rebuild.
- All new DB writes go through `createServerFn` with `requireSupabaseAuth` and `requireRole`.
- Every new table: GRANTs + RLS + policies in the same migration.
- All user input validated with Zod (server) + mirrored client validation.
- Semantic tokens only — no raw colors in components.

---

## Phase 1 — Landing page upgrade (UI only)

**Why:** First impression drives investor + tenant trust.

Refactor `src/routes/index.tsx` into composed sections:

- Premium hero (keep existing image, add smarter search bar with type/location/budget that deep-links to `/tenant?...`)
- Featured verified listings carousel (live from `properties` where `is_verified=true`)
- Popular neighborhoods grid (counts from `properties`)
- "Why Nyumba Search" (verification, no agent fees, map-first, AI)
- Testimonials (static seed; table comes in Phase 2)
- App CTA band
- SEO: per-section semantic HTML, JSON-LD `RealEstateAgent`, og tags

No schema changes.

---

## Phase 2 — Trust & verification system

**Why:** Scams are the #1 housing pain point in Kenya. This is the moat.

**Schema (one migration):**

- `verifications` — user_id, level (`phone|id|business|ownership`), status (`pending|approved|rejected`), evidence_url, reviewed_by, reviewed_at
- `trust_scores` — user_id (PK), score (0–100), computed_at
- `scam_reports` — reporter_id, property_id|reported_user_id, reason, status
- `properties.authenticity_score` (int), `properties.verification_level` (enum)
- Storage bucket `verification-docs` (private, owner-only RLS)

**ServerFns:** `submitVerification`, `listMyVerifications`, `reportScam`, `getTrustScore`.

**UI:**

- `<VerificationBadge level={1..4}>` reused on PropertyCard, listing page, landlord profile
- Tenant + landlord profile sections to upload phone OTP / ID / business cert / title deed
- "Report listing" button on `tenant.property.$id.tsx`
- Automated flags (server cron-style serverFn, manually triggerable for now): duplicate image hashes (perceptual hash of `properties.images[0]`), prices >3σ outside neighborhood mean, listings inactive >60 days

---

## Phase 3 — Reviews & community

**Why:** Social proof + neighborhood truth that competitors lack.

**Schema:**

- `property_reviews` — reviewer_id, property_id, ratings JSONB (security, water, internet, noise, cleanliness, accessibility, landlord), comment, verified_stay bool
- `neighborhood_reviews` — reviewer_id, neighborhood text, ratings JSONB (safety, traffic, schools, hospitals, shops, transport), comment
- Trigger to refresh aggregate `properties.avg_rating` / `properties.review_count`

**UI:** Reviews tab on listing page, neighborhood pages at `/tenant/neighborhood/$name`, star summaries on cards.

---

## Phase 4 — Advanced search & richer listing page

**Why:** Discovery is the core job.

- Expand filters in `tenant.index.tsx` + new `/tenant/search` route: listing intent (rent/buy/commercial/land — adds `properties.listing_intent` enum), price slider, bed/bath, security/water/internet ratings (from reviews), parking, pet-friendly, furnished, distance-from-point.
- Map search upgrade in `tenant.map.tsx`: clustering, draw polygon filter (Google Maps Drawing lib), "show similar" within radius.
- Listing page (`tenant.property.$id.tsx`): full gallery lightbox, video player, embedded virtual tour iframe, similar properties (same neighborhood + ±20% rent), community reviews tab, health score chip, sticky CTA bar (Call / WhatsApp `wa.me/` deep-link / Message / Book Viewing / Save / Share).

---

## Phase 5 — Dashboards, messaging, bookings

**Why:** Retention.

**Tenant dashboard:** saved listings (exists), search alerts (`saved_searches` table + nightly notify serverFn stub), viewings list, compare-up-to-3 view, applications history.

**Landlord dashboard:** extend existing `landlord.analytics.tsx` with revenue placeholder, lead funnel, occupancy %, per-listing views chart from `property_views`.

**Agent dashboard:** new `agent` role, routes under `/agent/*`, CRM-style leads board.

**Messaging:** `inquiry_messages` already exists — add realtime via `supabase.channel()`, typing indicator (broadcast), read receipts (column `read_at`), image attachments via Storage bucket `chat-media`.

**Bookings:** `viewings` table (property_id, tenant_id, landlord_id, scheduled_at, status, reminder_sent). Calendar UI with date/time picker, ICS download, reschedule/cancel.

---

## Phase 6 — AI assistant + admin panel

**Why:** Differentiation + operational control.

**AI Assistant** (Lovable AI Gateway via `createServerFn` — no extra keys):

- `src/lib/ai-gateway.server.ts` helper (per knowledge file)
- `src/routes/api/chat.ts` streaming route using `streamText` with `google/gemini-3-flash-preview`
- Tools: `searchProperties`, `getPropertyDetails`, `getNeighborhoodStats`, `bookViewing` (`needsApproval: true`)
- Floating assistant launcher on tenant pages, AI Elements (`Conversation`, `Message`, `PromptInput`) installed via `bunx ai-elements@latest add ...`
- One conversation per user, persisted in localStorage (no DB) — keeps scope tight

**Admin panel:**

- Add `admin` to `app_role` enum
- Routes under `/admin/*` gated by `requireRole(supabase, userId, 'admin')`
- Users list, verification queue (approve/reject), property moderation, scam reports queue, audit log (`admin_audit_log` table writes on every admin action), platform analytics

---

## Cross-cutting (folded into each phase)

- **Performance:** lazy-load route components, `loading="lazy"` + `decoding="async"` on images, replace hero `<img>` with `<picture>` srcset, prefetch verified carousel.
- **SEO:** unique `head()` per route, JSON-LD `Residence`/`Place` on listing page, sitemap server route.
- **A11y:** focus states, aria-labels on icon buttons, color-contrast audit against existing tokens.
- **Security:** Zod validation everywhere, signed URLs for verification docs, rate-limit `reportScam` and `submitVerification` (simple per-user count check), keep current RLS/has_role pattern.

---

## Technical details

- New tables follow the existing pattern: `id uuid pk`, `created_at/updated_at`, RLS enabled, GRANTs to `authenticated`/`service_role`, policies scoped via `auth.uid()` or `has_role()`.
- Triggers use `set_updated_at()` (already exists).
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE ...` for `inquiry_messages` + `viewings`.
- Image hashing for duplicate detection: pure-JS pHash in a serverFn — no native deps (Worker-compatible).
- AI tools call internal serverFns directly — no external API surface.
- No payment/M-Pesa work this round (deferred).

---

## Suggested execution order

I'll implement **Phase 1 first** and stop for your review before each subsequent phase, so you can course-correct. Each phase is 1 focused turn.

Ready to start with Phase 1 (landing page) on approval.
