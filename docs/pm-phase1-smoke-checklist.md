# Property Management Suite — Phase 1 smoke checklist

Manual verification against a landlord (or agency/manager) account after applying
`supabase/migrations/20260724140000_property_management_phase1.sql`.

- [ ] Create a property with no buildings, add 3 units directly — works
- [ ] Create a property WITH buildings, add units nested under a building — works
- [ ] Add a tenant without portal invite — `portal_status = not_invited`
- [ ] Invite a tenant with no NyumbaSearch account → signup-first → `tenant_user_id` links
- [ ] Invite a tenant who already has an account → accept links existing profile (no duplicate)
- [ ] Tenant declines invite → `portal_status = declined`; landlord can still manage lease
- [ ] Monthly cron (`/api/cron/monthly`) generates one invoice per active lease; re-run does not duplicate
- [ ] Record partial payment → invoice `partial`
- [ ] Record completing payment → invoice `paid`
- [ ] Daily cron (`/api/cron/daily`) flags pending/partial past `due_date` as `overdue`
- [ ] Publish vacant unit → marketplace `properties` row + `linked_listing_id`
- [ ] Staff `property_manager` can manage units/tenants; `payments:create` denied server-side
- [ ] Staff `caretaker` can view units/tenants/maintenance; cannot view invoices
- [ ] Dashboard occupancy / collected / outstanding match seeded data
- [ ] Landlord with zero public listings can use Manage portfolio with no marketplace friction

Automated: `npx vitest run tests/unit/pm-access.test.ts`
