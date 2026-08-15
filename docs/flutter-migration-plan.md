# NyumbaSearch Flutter Migration Plan

**Status:** Phases 0–6 complete (Tenant MVP)  
**Date:** 2026-08-07  
**Package ID (Play Store):** `ke.co.nyumbasearch.app` (unchanged)

## Goal

Add a **native Flutter** mobile frontend that shares the existing Supabase + Cloudflare Worker backend with the website. The website remains the production web client. The existing Android **WebView** shell stays intact until Flutter Tenant MVP is approved for cutover.

## Architecture

```
                 NYUMBASEARCH
                      |
          +-----------+-----------+
          |                       |
       WEBSITE               FLUTTER APP
   (TanStack Start)         (flutter_app/)
          |                       |
          +-----------+-----------+
                      |
            Cloudflare Worker
            + createServerFn (web)
            + /api/* REST
            + /api/mobile/v1/* BFF (NEW, additive)
                      |
                   Supabase
              (Auth / DB / Storage)
```

### Critical constraint

Most business APIs are TanStack `createServerFn` handlers, not public REST. Flutter must use:

1. `supabase_flutter` — Auth + Storage + RLS-safe reads  
2. `/api/mobile/v1/*` — Bearer-authenticated BFF wrapping **existing** cores  
3. Never embed `SUPABASE_SERVICE_ROLE_KEY` or payment secrets

### Client headers

| Client | Header |
|--------|--------|
| Flutter | `Authorization: Bearer <access_token>` + `X-App-Client: flutter` |
| Legacy WebView | `X-App-Client: android` (must keep working) |

## What already exists (reuse)

- Auth: email/password, Google OAuth (PKCE), phone signup OTP, custom password reset
- Roles: `user_roles` (`tenant`, `landlord`, `manager`, `agency`, `caretaker`, `admin`)
- Marketplace: `properties`, `saved_properties`, contact unlock paywall
- Payments: IntaSend (rent), Daraja STK (non-rent), Pesapal (card)
- Storage: `property-media`, `verification-documents`
- Maps: Mapbox (+ Google fallback), `/api/mapbox-token`
- FCM: `/api/mobile/fcm-token` + `registerFcmToken`

## Must remain untouched

- Website routes/UI under `src/routes`, `src/components`
- Production users, listings, storage objects
- Payment webhook URLs and fulfillment
- RLS / PII lockdown (contact phones behind unlock)
- Application ID `ke.co.nyumbasearch.app`
- WebView Android project until explicit cutover approval
- No destructive DB migrations without explicit approval

## Phase 0 — Scaffold (done)

- This document
- `flutter_app/` clean architecture (Riverpod, GoRouter, Freezed deps, Material 3)
- Env templates (publishable keys only)
- Networking + secure-config + error handling foundation

## Phase 1 — Mobile BFF Tenant MVP (done, live)

Additive routes under `/api/mobile/v1/*` on `https://nyumbasearch.com`.

## Phase 2 — Flutter auth + tenant browse (done)

- Email/password sign-in & sign-up via existing Supabase Auth
- Google OAuth (requires Supabase redirect allowlist for `ke.co.nyumbasearch.app://login-callback/`)
- Session restore + logout
- Home feed, search/filters, property details + image gallery against live BFF listings

## Phase 3 — Map + favorites (done)

- Native map (`flutter_map` + Mapbox streets tiles via existing `/api/mapbox-token`)
- Property markers + preview card → detail
- Optional my-location (permission-aware)
- Favorites heart on cards/detail; Saved tab via `/api/mobile/v1/saved`

## Phase 4 — Contact unlock + M-Pesa STK (done)

- Property detail `ContactUnlockCard` uses `/api/mobile/v1/unlock/:id` (GET/POST)
- Plus / trial: free reveal button still available (no fee → no STK)
- Paid path always visible: M-Pesa phone + **Pay via M-Pesa STK** → Daraja STK push
- Poll `/api/mobile/v1/payments/:id` until completed/failed
- Revealed phones: call + WhatsApp actions

## Phase 5 — Profile, roles, App Links (done)

- Profile loads `/api/mobile/v1/me` (name, phone, trial unlocks, roles)
- Non-tenant roles open the matching website portal in the browser
- Android App Links for `https://nyumbasearch.com/tenant/property/:id` (+ www / `/property/:id`)
- Deep-link mapping → in-app `/property/:id` (same package as WebView; `assetlinks.json` unchanged)

## Phase 6 — QA + AAB (done)

- Unit tests green (11); analyzer clean aside from optional infos
- Live smoke: BFF `/health` + `/listings` with `X-App-Client: flutter`; site `/api/health` 200
- Release signing via optional `android/key.properties` (same upload keystore as WebView for Play)
- Version **1.0.13+14**; `compileSdk = 37`
- AAB: `flutter_app/build/app/outputs/bundle/release/app-release.aab` (~53 MB, debug-signed until `key.properties`)
- Checklist: [`flutter_app/docs/qa-aab.md`](../../flutter_app/docs/qa-aab.md)
- Cutover: [`flutter_app/docs/cutover.md`](../../flutter_app/docs/cutover.md)
- Live smoke: `cd flutter_app && dart run tool/live_bff_smoke.dart`

## Security checklist

- [x] No service-role key in Flutter  
- [x] BFF validates Bearer via Supabase Auth  
- [x] Unlock/payment go through existing cores  
- [x] Android WebView FCM client still accepted  
- [x] Production deploy of BFF only after local typecheck + smoke  

## Repo layout

```
nyumbani/
  find-nyumba-smart/   # website + Worker (submodule)
  flutter_app/         # NEW Flutter client
  docs/                # parent docs (optional)
```
