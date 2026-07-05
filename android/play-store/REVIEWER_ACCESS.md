# Play Store — App access (reviewer instructions)

Paste into Play Console → **App content → App access**.

---

## Access type

Select: **All or some functionality is restricted**

Then choose: **Provide instructions for logging in**

---

## Instructions for reviewers (copy/paste)

```
NyumbaSearch is a WebView app that loads https://nyumbasearch.com. Most features work without login (browse listings, search, map, property details).

To test signed-in features, use one of these test accounts:

TENANT (browse, save, message)
Email: smoke-tenant@nyumbasearch.app
Password: NyumbaPortalTest!2026

LANDLORD (list and manage properties)
Email: smoke-landlord@nyumbasearch.app
Password: NyumbaPortalTest!2026

Steps:
1. Open the app
2. Tap the menu / go to Sign in (https://nyumbasearch.com/auth)
3. Enter email and password above
4. Tenant: search from home, open a listing, view map at /tenant/map
5. Landlord: open landlord dashboard to see listing management

Payments (M-Pesa / card) open in the system browser for security — this is intentional.

Camera permission: only requested when a logged-in landlord uploads listing photos.
Location permission: only requested when the user taps "near me" or opens the map.

No special hardware required. Internet connection required.
```

---

## Optional: dedicated reviewer account (recommended for production)

Create a fresh account in Supabase/auth for reviewers only, e.g.:

```
Email: playstore-review@nyumbasearch.app
Password: [generate a strong unique password]
```

Update the Play Console instructions with that account and disable or rotate the password after approval.

---

## Demo payments

If asked about payments: checkout uses **Flutterwave** and **M-Pesa** in the external browser. The Android app does not store card numbers or M-Pesa PINs. Set `ALLOW_DEMO_PAYMENTS` only in staging — production uses real payment providers.

---

## Deep link test (for your own QA)

After uploading a signed build and updating `assetlinks.json` with your release SHA-256:

```
https://nyumbasearch.com/tenant
https://nyumbasearch.com/property/[any-valid-listing-slug]
```

Shared via WhatsApp, these should offer "Open in NyumbaSearch" when the app is installed.
