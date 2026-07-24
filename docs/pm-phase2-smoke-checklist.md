# Property Management Suite — Phase 2 smoke checklist

After applying `20260724150000_pm_rent_mpesa_phase2.sql` (`npm run db:migrate:pm-phase2`)
and `20260724160000_pm_rent_payment_id_unique.sql` (`npm run db:migrate:pm-rent-unique`):

- [ ] Tenant with accepted portal link sees invoices on `/tenant/rent`
- [ ] Pay Rent → STK push → PIN → webhook → invoice `paid` or `partial`
- [ ] Partial M-Pesa payment leaves `partial`; second payment against same invoice works
- [ ] Rent receipt email includes M-Pesa reference
- [ ] Landlord receives email notification after payment
- [ ] Daily cron reminders send once per stage (upcoming / due_today / overdue_3day / overdue_7day)
- [ ] Late fee applies once when overdue (`late_fee = 0` → set); does not re-compound
- [ ] Tenant cannot pay another tenant's invoice
- [ ] Tenant cannot pay an already-paid invoice
- [ ] Double-click Pay does not create two STK pushes (idempotency key `rent-{invoiceId}`)
- [ ] Agency/manager “Record payment” works (includes late fee in suggested amount)

Automated: `npx vitest run tests/unit/pm-rent-phase2.test.ts tests/unit/pm-access.test.ts`
