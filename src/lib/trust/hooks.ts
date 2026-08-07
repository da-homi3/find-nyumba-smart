import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { asPmDb, type PmDb } from "@/lib/pm/access";

type Admin = SupabaseClient<Database> | PmDb;

function db(admin: Admin): PmDb {
  return asPmDb(admin);
}

/** Best-effort trust/loyalty side-effects — never throw into payment/maintenance flows. */
export async function onRentInvoicePaid(
  admin: Admin,
  opts: {
    tenantUserId: string | null;
    invoiceId: string;
    dueDate: string;
    wasOverdue: boolean;
    lateFee: number;
  },
): Promise<void> {
  if (!opts.tenantUserId) return;
  try {
    const { recordFactor } = await import("@/lib/reputation/calculate");
    const { awardPoints } = await import("@/lib/loyalty/points");
    const client = db(admin);

    const due = opts.dueDate.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const onTime = !opts.wasOverdue && opts.lateFee <= 0 && today <= due;

    if (onTime) {
      await recordFactor(client, {
        userId: opts.tenantUserId,
        factorType: "on_time_payment",
        relatedId: opts.invoiceId,
      });
      await awardPoints(client, {
        userId: opts.tenantUserId,
        reason: "on_time_rent_payment",
        relatedId: opts.invoiceId,
      });
    } else {
      await recordFactor(client, {
        userId: opts.tenantUserId,
        factorType: "late_payment",
        relatedId: opts.invoiceId,
      });
    }
  } catch (err) {
    console.warn("[trust] onRentInvoicePaid failed", err);
  }
}

export async function onInvoicesFlaggedOverdue(admin: Admin, invoiceIds: string[]): Promise<void> {
  if (!invoiceIds.length) return;
  try {
    const { recordFactor } = await import("@/lib/reputation/calculate");
    const pm = db(admin);
    const { data: invoices } = await pm
      .from("pm_rent_invoices")
      .select("id, lease_id")
      .in("id", invoiceIds);
    if (!invoices?.length) return;

    const leaseIds = [
      ...new Set((invoices as Array<{ id: string; lease_id: string }>).map((i) => i.lease_id)),
    ];
    const { data: leases } = await pm.from("pm_leases").select("id, tenant_id").in("id", leaseIds);
    const leaseById = new Map(
      ((leases ?? []) as Array<{ id: string; tenant_id: string }>).map((l) => [l.id, l]),
    );

    const tenantIds = [
      ...new Set(((leases ?? []) as Array<{ tenant_id: string }>).map((l) => l.tenant_id)),
    ];
    const { data: tenants } = await pm
      .from("pm_tenants")
      .select("id, tenant_user_id")
      .in("id", tenantIds);
    const tenantById = new Map(
      ((tenants ?? []) as Array<{ id: string; tenant_user_id: string | null }>).map((t) => [
        t.id,
        t,
      ]),
    );

    for (const inv of invoices as Array<{ id: string; lease_id: string }>) {
      const lease = leaseById.get(inv.lease_id);
      if (!lease) continue;
      const tenant = tenantById.get(lease.tenant_id);
      if (!tenant?.tenant_user_id) continue;
      await recordFactor(pm, {
        userId: tenant.tenant_user_id,
        factorType: "late_payment",
        relatedId: inv.id,
      });
    }
  } catch (err) {
    console.warn("[trust] onInvoicesFlaggedOverdue failed", err);
  }
}

export async function onMaintenanceConfirmed(
  admin: Admin,
  opts: { requestId: string; assignedProviderId: string | null },
): Promise<void> {
  try {
    const { recordFactor } = await import("@/lib/reputation/calculate");
    const { awardPoints } = await import("@/lib/loyalty/points");
    const client = db(admin);

    if (!opts.assignedProviderId) return;

    const { data: provider } = await client
      .from("service_providers")
      .select("user_id")
      .eq("id", opts.assignedProviderId)
      .maybeSingle();

    const providerUserId = (provider as { user_id?: string | null } | null)?.user_id;
    if (!providerUserId) return;

    await recordFactor(client, {
      userId: providerUserId,
      factorType: "job_completed",
      relatedId: opts.requestId,
    });
    await awardPoints(client, {
      userId: providerUserId,
      reason: "maintenance_job_completed",
      relatedId: opts.requestId,
    });
  } catch (err) {
    console.warn("[trust] onMaintenanceConfirmed failed", err);
  }
}

export async function onVerificationApproved(
  admin: Admin,
  opts: {
    userId: string;
    verificationId: string;
    verificationType: string;
  },
): Promise<void> {
  try {
    const { recordFactor } = await import("@/lib/reputation/calculate");
    const { awardPoints } = await import("@/lib/loyalty/points");
    const client = db(admin);

    const factorType =
      opts.verificationType === "ownership" ? "ownership_verified" : "identity_verified";

    await recordFactor(client, {
      userId: opts.userId,
      factorType,
      relatedId: opts.verificationId,
    });
    await awardPoints(client, {
      userId: opts.userId,
      reason: "profile_verified",
      relatedId: opts.verificationId,
    });
  } catch (err) {
    console.warn("[trust] onVerificationApproved failed", err);
  }
}

export async function onListingUpdated(
  admin: Admin,
  userId: string,
  propertyId: string,
): Promise<void> {
  try {
    const { awardPoints } = await import("@/lib/loyalty/points");
    await awardPoints(db(admin), {
      userId,
      reason: "listing_kept_updated",
      relatedId: `${propertyId}:${new Date().toISOString().slice(0, 10)}`,
    });
  } catch (err) {
    console.warn("[trust] onListingUpdated failed", err);
  }
}
