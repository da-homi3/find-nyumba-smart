# NyumbaSearch — Feature Report

Requested interactive features vs current implementation.

| Feature               | Status                   | Location                                                    |
| --------------------- | ------------------------ | ----------------------------------------------------------- |
| Compare Listings      | **Shipped** (this audit) | `/tenant/compare`, `compareProperties`                      |
| Save Search Alerts    | **Shipped**              | `search.functions.ts`, settings + tenant profile            |
| AI Rent Estimator     | **Shipped**              | Property detail AI valuation widget                         |
| Recently Viewed       | **Shipped** (this audit) | `recently-viewed.ts`, tenant browse strip                   |
| Street View           | **Partial**              | Google Maps on `/tenant/map`; no dedicated Street View pane |
| Viewing Scheduler     | **Shipped**              | `BookingModal`, `booking.functions.ts`                      |
| Property Timeline     | **Not built**            | Recommend: `property_events` table + detail tab             |
| Landlord Trust Score  | **Partial**              | Verification badges + authenticity score on listings        |
| Commute Calculator    | **Not built**            | Recommend: Maps Distance Matrix API                         |
| Tenant Reviews        | **Shipped**              | `PropertyReviewsSection`, gated reviews                     |
| Mortgage Calculator   | **Not built**            | `/finance` marketing page only                              |
| Interactive Heatmap   | **Shipped**              | Map rent heat layer + toggle                                |
| Availability Calendar | **Partial**              | Viewing slots via booking; no full calendar UI              |
| Share Property        | **Shipped**              | Web Share API + clipboard on detail                         |
| Report Listing        | **Shipped**              | `PropertyReportSection`, trust API                          |
| Chat System           | **Shipped**              | Inquiries + `tenant.messages`                               |
| WhatsApp Inquiry      | **Partial**              | `wa.me` patterns in intel; not universal CTA                |
| Notifications         | **Shipped**              | Prefs in settings, search alerts, viewing reminders         |
| Wishlist              | **Shipped**              | Saved properties (`tenant.saved`)                           |
| Voice Search          | **Not built**            | Recommend: Web Speech API on tenant search                  |
| Dark Mode             | **Shipped** (this audit) | Settings → Appearance                                       |

## User flows

| Flow                                                  | Status                                |
| ----------------------------------------------------- | ------------------------------------- |
| Tenant: Search → View → Save → Contact → Book         | **E2E scripts pass** (`test:e2e`)     |
| Landlord: Sign in → Create listing → Verify → Publish | **Dashboard E2E** (`test:dashboards`) |
| Agency: Dashboard → Analytics → Leads                 | **Portal E2E** (`test:portals`)       |

## Recommended next sprint

1. Commute calculator (Maps Directions API)
2. Property timeline for landlords
3. Voice search on tenant hero
4. Street View embed on property detail when lat/lng present
5. Mortgage widget on `/finance`
