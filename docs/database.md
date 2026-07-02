# NyumbaSearch — Database (Supabase Postgres)

Schema is managed via Supabase migrations and apply scripts under `scripts/apply-*-migration.mjs`. Below is the logical model inferred from application code.

## Entity relationship (core)

```mermaid
erDiagram
  auth_users ||--o{ profiles : has
  auth_users ||--o{ user_roles : has
  auth_users ||--o{ properties : owns
  properties ||--o{ saved_properties : saved_by
  properties ||--o{ contact_unlocks : unlocked_for
  properties ||--o{ listing_boosts : boosted
  auth_users ||--o{ subscriptions : subscribes
  auth_users ||--o{ payments : pays
  auth_users ||--o{ inquiries : receives
  auth_users ||--o{ service_providers : operates
  service_providers ||--o{ provider_inquiries : receives
  auth_users ||--o{ verification_requests : requests

  profiles {
    uuid id PK
    text full_name
    text phone
    text landlord_plan
    boolean is_plus
    text active_portal
  }

  properties {
    uuid id PK
    uuid owner_id FK
    text title
    text neighborhood
    int rent
    int bedrooms
    float lat
    float lng
    boolean is_active
    boolean is_verified
    timestamptz featured_until
    int views
  }

  payments {
    uuid id PK
    uuid user_id FK
    text payment_type
    int amount
    text status
    text provider_ref
    jsonb metadata
  }

  subscriptions {
    uuid id PK
    uuid user_id FK
    text plan
    text status
    timestamptz current_period_end
    text billing_method
  }

  contact_unlocks {
    uuid id PK
    uuid user_id FK
    uuid listing_id FK
    text method
  }

  service_providers {
    uuid id PK
    uuid user_id FK
    text business_name
    jsonb categories
    text tier
    text status
  }

  verification_requests {
    uuid id PK
    uuid user_id FK
    text tier
    text status
    boolean paid
  }
```

## Tables referenced in code

| Table                   | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `profiles`              | User profile, landlord plan, Plus status, portal preference |
| `user_roles`            | Approved portal roles per user                              |
| `properties`            | Rental listings                                             |
| `saved_properties`      | Tenant saved/favourited listings                            |
| `contact_unlocks`       | Paid/trial/plus contact reveals                             |
| `payments`              | All payment attempts and receipts                           |
| `subscriptions`         | Recurring landlord/tenant/provider subscriptions            |
| `listing_boosts`        | Active property boost packages                              |
| `inquiries` / `leads`   | Landlord lead inbox                                         |
| `verification_requests` | Property verification orders                                |
| `service_providers`     | Home services marketplace                                   |
| `provider_inquiries`    | Tenant → provider messages                                  |
| `organization_members`  | Agency team membership                                      |
| `portal_applications`   | Pending landlord/agency signup requests                     |
| `rental_transactions`   | Revenue ledger entries                                      |

## Migration commands

Use Supabase CLI or project scripts (not D1 `wrangler d1 execute`):

```bash
# Revenue schema
npm run db:migrate:push

# Column patches
npm run db:migrate:columns

# Contact unlock
npm run db:migrate:contact-unlock

# RLS hardening (run in order as needed)
npm run db:migrate:rls
npm run db:migrate:revenue-rls
npm run db:migrate:foundation-rls
```

See [migrations.md](./migrations.md) for the full ordered list.

## RLS

Row-level security is enforced in Supabase. Server-side operations use `SUPABASE_SERVICE_ROLE_KEY` for trusted Worker logic (payments, cron, admin).
