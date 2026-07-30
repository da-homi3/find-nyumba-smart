# NyumbaSearch — Property Management Suite

## Master Reference — All 4 Phases Consolidated

Single index for the full suite. Detailed phase prompts live elsewhere; this document
reflects **what is actually running** on NyumbaSearch (Supabase Postgres + Cloudflare Workers),
not the original SQLite / D1 draft schemas.

---

## HOW THE FOUR PHASES FIT TOGETHER

```
                    ┌─────────────────────────────────────────┐
                    │   EXISTING PLATFORM (unchanged, reused)   │
                    │   Auth · RBAC · M-Pesa · Email · Providers │
                    │   Notifications · Marketplace listings    │
                    └───────────────────┬───────────────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        │               │               │               │               │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
   │ PHASE 1 │    │  PHASE 2   │   │  PHASE 3   │   │  PHASE 4   │
   │Properties│──▶│  M-Pesa    │   │Maintenance │   │Multi-role  │
   │Units    │    │  Rent      │   │+ Provider  │   │+ Reputation│
   │Tenants  │    │  Collection│   │  Assignment│   │+ Loyalty   │
   │Manual   │    │            │   │            │   │            │
   │Rent     │    │            │   │            │   │            │
   └─────────┘    └────────────┘   └────────────┘   └────────────┘
```

Build order matters: Phase 2 needs Phase 1 invoices; Phase 3 uses maintenance schema;
Phase 4 reputation/loyalty reads rent + maintenance signals.

---

## PHASE STATUS (LIVE)

| Phase | Status | Key artifacts |
|-------|--------|----------------|
| **1** Properties / units / tenants / manual rent | **Shipped** | `20260724140000_property_management_phase1.sql`, `pm.functions.ts`, `/landlord|agency|manager/manage/*` |
| **2** M-Pesa rent | **Shipped** | `*pm_rent*`, `rent-fulfillment.ts`, reminders + late fees |
| **3** Maintenance + providers | **Shipped** | `*pm_maintenance_phase3*`, state machine, WhatsApp accept/decline |
| **4** Multi-role + reputation/loyalty | **Shipped** | RoleSwitcher on existing `user_roles` + `active_portal`; `20260726120000_reputation_loyalty.sql` |

### Phase 4 implementation notes (vs original prompt)

- Multi-role storage already existed (`user_roles`). Phase 4 did **not** rewrite every
  `requireRole` to act-as-only (decision **1A**: UX-first OR authz).
- Landlord/agency/manager still require **portal application approval** (decision **2A**).
- RoleSwitcher switches among granted roles; “Add another role” → Settings apply flow.

---

## ADD-ONS (POST PHASE 4)

| Feature | Status | Location |
|---------|--------|----------|
| Property health score | Shipped | `src/lib/pm/property-health.ts` + PM dashboard |
| Financial report export (CSV / Excel / PDF) | Shipped | `src/lib/pm/financial-report.ts` + rent/dashboard export UI |
| **PM module separation + independent billing** | Shipped | `20260726140000_pm_module_separation_payment_integrity.sql`, `pm-module.functions.ts`, manage upsell/subscribe |
| **Off-app rent claims + append-only ledger** | Shipped | `pm_rent_payment_claims`, reversals via `invoice-integrity.ts`, tenant rent UI |
| **Admin PM oversight** | Shipped | Admin tab “Property Mgmt” — subs, disputes, reversals |
| **Rent payouts + 1% platform fee** | Shipped | Instant IntaSend payout after rent collection (bank / M-Pesa phone / paybill / till); daily cron as catch-up |

---

## MODULE BILLING (INDEPENDENT)

Marketplace plans (`subscriptions.module = 'marketplace'`) and Property Management
(`module = 'property_management'`, plans `pm-starter` / `pm-growth` / `pm-scale`) are
independent. A landlord can hold either, both, or neither. First-month free trial is
scoped **per module**. Feature gate: `pm_properties.pm_module_active` +
`requirePmModule` / upsell on `/landlord|agency|manager/manage`.

---

## DELIBERATELY STILL OUT OF SCOPE

- Digital lease e-signatures (PDF upload URL only)
- Visitor / gate / parcel security logs
- Landlord portfolio AI (“who hasn’t paid?”) — data ready, no Claude query layer yet

---

## KEY TABLE PREFIX

All PM tables use the `pm_` prefix (`pm_properties`, `pm_units`, `pm_leases`,
`pm_rent_invoices`, `pm_maintenance_requests`, …) so they do not collide with the
marketplace `properties` listings table.

---

## WHERE TO START

1. Read this map.
2. Exercise `/landlord/manage` (or agency/manager) end-to-end — without a PM sub you
   should see the upsell; subscribe (or use grandfathered properties) to unlock.
3. For trust/loyalty: Settings → Trust & rewards; triggers fire from rent pay / maintenance confirm / verification approve.
4. Unit tests: `npm run test:unit` (includes PM + health + report + module separation).
