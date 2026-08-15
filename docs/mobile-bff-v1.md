# Mobile BFF v1 — Flutter contracts

Base: `https://nyumbasearch.com/api/mobile/v1`

Required headers (all routes except noted):

```
X-App-Client: flutter
Authorization: Bearer <supabase_access_token>   # required for authenticated routes
```

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | no | `{ apiVersion, status, service }` |
| GET | `/me` | yes | profile + roles |
| GET | `/listings` | no* | same filters as `/api/listings` |
| GET | `/listings/:id` | no* | full listing detail |
| GET | `/saved` | yes | tenant saved properties |
| PUT | `/saved/:propertyId` | yes | save |
| DELETE | `/saved/:propertyId` | yes | unsave |
| GET | `/unlock/:listingId` | yes | unlock state (shared core) |
| POST | `/unlock/:listingId` | yes | initiate unlock / STK |
| GET | `/payments/:paymentId` | yes | poll payment status |
| POST | `/fcm-token` | yes | body `{ token }` |

\* Listings still require `X-App-Client: flutter`.

Legacy WebView FCM (`POST /api/mobile/fcm-token` with `X-App-Client: android`) is unchanged and still works; it also accepts `flutter`.

All protected business logic reuses existing Worker cores (`queryListings`, contact-unlock-core, `initiatePaymentCore`, `registerFcmToken`).
