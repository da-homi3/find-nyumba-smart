import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { asPmDb } from "@/lib/pm/access";
import { notifyUser } from "@/lib/notifications/notify-user";
import { formatKes } from "@/lib/properties";

const claimMethodSchema = z.enum(["cash", "bank_transfer", "mpesa_direct_to_landlord", "other"]);

export const submitPmPaymentClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.number().int().positive(),
      method: claimMethodSchema,
      paidOnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().max(1000).optional().nullable(),
      attachmentUrl: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");
    const admin = asPmDb(await adminClient());

    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("id, full_name")
      .eq("tenant_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!tenant) throw new Error("No tenant record found");

    const { data: invoice } = await admin
      .from("pm_rent_invoices")
      .select("id, lease_id, amount_due, amount_paid, late_fee, status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (!invoice) throw new Error("Invoice not found");

    const { data: lease } = await admin
      .from("pm_leases")
      .select("id, tenant_id, unit_id")
      .eq("id", invoice.lease_id)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!lease) throw new Error("This invoice is not linked to your tenancy");

    const { data: pending } = await admin
      .from("pm_rent_payment_claims")
      .select("id")
      .eq("invoice_id", data.invoiceId)
      .eq("tenant_id", tenant.id)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) {
      throw new Error("You already have a pending claim for this invoice");
    }

    const { data: claim, error } = await admin
      .from("pm_rent_payment_claims")
      .insert({
        invoice_id: data.invoiceId,
        tenant_id: tenant.id,
        amount_claimed: data.amount,
        method: data.method,
        paid_on_date: data.paidOnDate,
        note: data.note ?? null,
        attachment_url: data.attachmentUrl ?? null,
        status: "pending",
      })
      .select("id, status")
      .single();
    if (error) throw error;

    const { data: unit } = await admin
      .from("pm_units")
      .select("property_id, unit_label")
      .eq("id", lease.unit_id)
      .maybeSingle();
    if (unit) {
      const { data: property } = await admin
        .from("pm_properties")
        .select("id, name, owner_user_id")
        .eq("id", unit.property_id)
        .maybeSingle();
      if (property?.owner_user_id) {
        await notifyUser(await adminClient(), {
          userId: property.owner_user_id,
          type: "rent",
          title: "Off-app rent payment claim",
          body: `${tenant.full_name} claims ${formatKes(data.amount)} for unit ${unit.unit_label}`,
          href: `/landlord/manage/${property.id}/rent`,
          entityType: "rent_payment_claim",
          entityId: claim.id,
        });
      }
    }

    return { claimId: claim.id, status: claim.status as string };
  });

export const listTenantPmPaymentClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");
    const admin = asPmDb(await adminClient());

    const { data: tenants } = await admin
      .from("pm_tenants")
      .select("id")
      .eq("tenant_user_id", userId)
      .is("deleted_at", null);
    const tenantIds = (tenants ?? []).map((t: { id: string }) => t.id);
    if (tenantIds.length === 0) return [];

    const { data, error } = await admin
      .from("pm_rent_payment_claims")
      .select("*")
      .in("tenant_id", tenantIds)
      .order("submitted_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });
