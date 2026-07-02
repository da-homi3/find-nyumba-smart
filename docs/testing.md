# Testing checklist

Run automated suite first:

```bash
npm run lint
npm run test:unit
npm run test:routes
npm run test:smoke
npm run build
```

## AUTH

- [ ] Register as tenant → verify email → account active
- [ ] Register as landlord → ops notification email (SendGrid)
- [ ] Password reset → email → link works
- [ ] Login with wrong password repeatedly → Supabase rate limit

## PAYMENTS

- [ ] Sandbox M-Pesa STK push → callback → plan/boost/unlock fulfilled
- [ ] Sandbox Pesapal card → redirect with `paymentId` → webhook → fulfilled
- [ ] Trial first-time Plus subscription → no immediate charge
- [ ] Renewal cron → STK/card charge → subscription extended

## EMAIL

- [ ] Registration → ops/applicant notification via SendGrid
- [ ] Payment success → receipt notification (where wired)
- [ ] Marketing opt-out respected (when implemented)

## LISTINGS

- [ ] Create property → appears in landlord list
- [ ] Submit for review → admin queue
- [ ] Admin approve → published + notification
- [ ] Contact unlock → payment → phone revealed

## CHECKOUT / BOOST (regression)

- [ ] `/landlord/checkout?plan=pro` — checkout form visible when signed in
- [ ] `/tenant/checkout?plan=plus` — Plus checkout with M-Pesa default tab
- [ ] `/landlord/boost?package=spotlight&propertyId=<uuid>` — skips to payment step
- [ ] Boost payment success → redirects to dashboard

## MAP

- [ ] `/tenant/map` loads Mapbox or fallback map with pins
- [ ] Filter/search updates visible count
- [ ] Pin click → side panel with listing details
- [ ] Security layer toggle recolours pins

## SERVICES

- [ ] `/services` hub shows categories
- [ ] `/services/register` shows provider signup (not hub duplicate)
- [ ] `/services/$category` lists providers (DB + placeholders)
- [ ] `/services/provider/$id` detail page loads

## REPORTS & HOMEPAGE

- [ ] `/reports` bar + line charts render (not empty boxes)
- [ ] Homepage trust stats animate from non-zero values

## VERIFY

- [ ] `/verify` — marketing landing
- [ ] `/verify/request` — intake form distinct from landing

## ADMIN

- [ ] Non-admin blocked from `/admin`
- [ ] Admin can review pending listings/users
