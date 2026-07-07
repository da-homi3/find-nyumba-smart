# Play Store — Data safety form

Use this when completing **App content → Data safety** in Play Console.

---

## Overview

| Question                                  | Answer                                           |
| ----------------------------------------- | ------------------------------------------------ |
| Does your app collect or share user data? | **Yes**                                          |
| Is all data encrypted in transit?         | **Yes** (HTTPS only)                             |
| Can users request data deletion?          | **Yes** — https://nyumbasearch.com/data-deletion |
| Committed to Google Play Families Policy? | **No** (not a kids app)                          |

---

## Data types collected

### Personal info

| Type          | Collected | Shared | Required           | Purpose                               |
| ------------- | --------- | ------ | ------------------ | ------------------------------------- |
| Name          | Yes       | No     | Optional (profile) | Account management, App functionality |
| Email address | Yes       | No     | Yes (account)      | Account management, App functionality |
| Phone number  | Yes       | No     | Optional           | Account management, App functionality |

### Location

| Type             | Collected | Shared | Required               | Purpose                                 |
| ---------------- | --------- | ------ | ---------------------- | --------------------------------------- |
| Precise location | Yes       | No     | Optional (user grants) | App functionality (near-me search, map) |

### Photos and videos

| Type   | Collected | Shared | Required | Purpose                             |
| ------ | --------- | ------ | -------- | ----------------------------------- |
| Photos | Yes       | No     | Optional | App functionality (listing uploads) |

### Financial info

| Type              | Collected | Shared | Required | Purpose                                                                                     |
| ----------------- | --------- | ------ | -------- | ------------------------------------------------------------------------------------------- |
| User payment info | **No**    | —      | —        | M-Pesa/card handled by Safaricom/Flutterwave in browser; app never sees PIN or card numbers |

### App activity

| Type                  | Collected | Shared | Required | Purpose                            |
| --------------------- | --------- | ------ | -------- | ---------------------------------- |
| App interactions      | Yes       | No     | Yes      | Analytics, App functionality       |
| In-app search history | Yes       | No     | Optional | App functionality (saved searches) |

### Device or other IDs

| Type                | Collected                                  | Shared | Required | Purpose                                |
| ------------------- | ------------------------------------------ | ------ | -------- | -------------------------------------- |
| Device or other IDs | Yes (FCM token when notifications enabled) | No     | Optional | App functionality (push notifications) |

---

## Data handling

| Question                            | Answer                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| Data processed ephemerally?         | No (accounts and listings persisted)                             |
| Is collection required or optional? | Mix — account email required for login; location/photos optional |
| Why is data collected?              | App functionality, Analytics, Account management                 |
| Why is data shared?                 | Not shared with third parties for advertising                    |

---

## Third-party SDKs (declare if prompted)

| SDK                               | Purpose            | Data                     |
| --------------------------------- | ------------------ | ------------------------ |
| Supabase                          | Auth, database     | Email, profile, listings |
| Mapbox                            | Map display        | Location (when map used) |
| Firebase Cloud Messaging (future) | Push notifications | FCM token                |
| Cloudflare                        | Hosting, CDN       | Request metadata         |

---

## Security practices

- Data encrypted in transit (TLS)
- Users can delete account/data via `/data-deletion`
- No sale of personal data
- WebView: mixed content blocked, HTTPS-only

---

## Content rating (IARC) — likely answers

| Topic                  | Answer                                      |
| ---------------------- | ------------------------------------------- |
| Violence               | None                                        |
| Sexuality              | None                                        |
| Language               | None                                        |
| Controlled substances  | None                                        |
| User-generated content | Yes (listings, messages) — moderated        |
| Location sharing       | Yes (optional)                              |
| Digital purchases      | Yes (subscriptions/boosts via web checkout) |
| Realistic gambling     | No                                          |

Expected rating: **Everyone** or **Teen** depending on financial transactions declaration.

---

## Target audience

- Primary: **18 and over**
- Not designed for children
