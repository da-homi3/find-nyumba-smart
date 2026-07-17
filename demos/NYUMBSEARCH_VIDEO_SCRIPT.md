# NyumbaSearch — Full App Walkthrough Script

**Live app:** https://nyumbasearch.com  
**Recorded video:** `demos/nyumbasearch-full-walkthrough.webm` (auto-generated via Playwright)

Use this script for a narrated Loom, Mainframe, or HeyGen presenter video (~12–15 minutes with auth demos).

---

## 1. Landing (`/`)

NyumbaSearch is a Nairobi rental platform built for tenants who want homes from verified property owners.

- Hero search: budget, property type, bedroom count
- Popular neighborhoods quick links
- Trust system: 4 verification levels (phone → ID → business → ownership)
- Property intelligence: water, security, internet data
- Testimonials and landlord CTA

**Demo:** Scroll landing, click “Browse homes” → `/tenant`

---

## 2. Tenant discovery (`/tenant`)

- Full-text search + filters (neighborhood, rent range, property types, sort)
- Listing cards with verification badges and listing intel
- Save heart (requires sign-in)
- Pagination

**Demo:** Apply filters, open a property card

---

## 3. Property detail (`/tenant/property/:id`)

- Photo gallery, rent, beds/baths, amenities
- Verification badge + intelligence panel (water, security, commute)
- **Book viewing** modal
- **Message landlord** / create inquiry
- **AI chat** — ask about the listing
- **AI valuation** estimate
- Reviews section
- Similar listings

---

## 4. Map (`/tenant/map`)

- Google Maps with clustered property pins
- Filter sync with search
- Click pin → preview / navigate to detail

---

## 5. Saved & profile (signed-in tenant)

| Route                        | Features                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| `/tenant/saved`              | Saved properties list                                       |
| `/tenant/profile`            | Preferences, saved-search alerts toggle, notification prefs |
| `/tenant/messages`           | Conversation threads with landlords                         |
| `/tenant/review/:propertyId` | Post-visit review form                                      |

---

## 6. Auth (`/auth`, `/auth/reset`, `/auth/pending`)

- Email/password sign-up and sign-in
- Role selection: tenant vs landlord/agency application
- Password reset via Supabase email link
- Pending application state for unapproved portal users

---

## 7. Landlord portal

| Route                      | Features                                               |
| -------------------------- | ------------------------------------------------------ |
| `/landlord`                | Sign-in / apply for landlord access                    |
| `/landlord/dashboard`      | Stats, recent viewings, M-Pesa listing boost           |
| `/landlord/dashboard/plan` | Premium subscription                                   |
| `/landlord/properties`     | Listings + AI quality score + **PropertyMediaManager** |
| `/landlord/properties/new` | Create listing wizard                                  |
| `/landlord/leads`          | Inquiries and lead management                          |
| `/landlord/analytics`      | Views and conversion metrics                           |
| `/landlord/caretakers`     | Assign caretakers with PIN access                      |

---

## 8. Agency portal

| Route                    | Features                     |
| ------------------------ | ---------------------------- |
| `/agency`                | Agency sign-in / application |
| `/agency/dashboard`      | Agency overview              |
| `/agency/properties`     | Portfolio listings           |
| `/agency/properties/new` | Add property                 |
| `/agency/leads`          | Lead pipeline                |
| `/agency/team`           | Organization members list    |

---

## 9. Caretaker (`/caretaker`, `/caretaker/dashboard`)

- PIN + phone sign-in (no full Supabase account)
- Dashboard for assigned properties: mark vacant/occupied, update status

---

## 10. Manager (`/manager`, `/manager/dashboard`)

- Property manager role portal (multi-property oversight)

---

## 11. Admin (`/admin`)

Tabs: verifications, scam reports, all properties, audit logs, portal applications.

- Approve/reject landlord & agency applications
- Moderate verification requests
- Review scam reports

---

## 12. Static pages

| Route       | Purpose                                   |
| ----------- | ----------------------------------------- |
| `/pricing`  | Plans for landlords                       |
| `/about`    | Mission and team                          |
| `/contact`  | Contact form (rate-limited, email notify) |
| `/settings` | Portal links hub (caretaker, etc.)        |

---

## Backend capabilities (not all visible in UI)

- Supabase auth + RLS
- M-Pesa STK push for boosts/subscriptions
- SendGrid ops notifications
- AI via Lovable API (valuation, chat, listing quality)
- Saved search alert emails
- Cloudflare Workers deployment

---

## Recording tips

1. Use a **tenant demo account** and **landlord demo account** for authenticated sections.
2. Show at least one **book viewing → landlord confirms** flow.
3. Upload a photo in **Property Media** to show storage + quality analysis.
4. For narrated video: approve **Mainframe** or **HeyGen** MCP in Cursor and ask to regenerate with this script + avatar.
