import { parseUuid, parseJsonBody, mapPmError, requireAdmin } from "@/lib/api/mobile/v1/helpers";
import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { asPmDb, assertPmPropertyAccess, assertStaffCan } from "@/lib/pm/access";
import { recordFeeAndDisburse } from "@/lib/pm/fee-and-payout";
import { recomputeInvoiceStatus } from "@/lib/pm/invoice-integrity";

const PAY_METHODS = ["manual", "cash", "bank"] as const;
const ID_VERIFY_STATUSES = ["approved", "rejected"] as const;

// ── Record off-app rent payment ──────────────────────────────────────────────

async function handleRecordPmPayment(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    invoiceId?: string;
    amount?: number;
    method?: string;
    note?: string | null;
  }>(req);
  if (body instanceof Response) return body;

  const invoiceId = parseUuid(body.invoiceId);
  if (!invoiceId) return mobileError("invoiceId required", "BAD_REQUEST", 400);

  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 1) {
    return mobileError("amount must be a positive number", "BAD_REQUEST", 400);
  }

  const method = body.method ?? "manual";
  if (!(PAY_METHODS as readonly string[]).includes(method)) {
    return mobileError(`method must be one of: ${PAY_METHODS.join(", ")}`, "BAD_REQUEST", 400);
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  try {
    const admin = asPmDb(auth.admin);
    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, propertyId);
    assertStaffCan(staffRole, "payments:create");

    const { data: invoice } = await admin
      .from("pm_rent_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return mobileError("Invoice not found", "NOT_FOUND", 404);

    const { data: lease } = await admin
      .from("pm_leases")
      .select("unit_id")
      .eq("id", invoice.lease_id)
      .maybeSingle();
    if (!lease) return mobileError("Lease not found", "NOT_FOUND", 404);

    const { data: unit } = await admin
      .from("pm_units")
      .select("property_id")
      .eq("id", lease.unit_id)
      .maybeSingle();
    if (unit?.property_id !== propertyId) {
      return mobileError("Invoice does not belong to this property", "FORBIDDEN", 403);
    }

    const { data: property } = await admin
      .from("pm_properties")
      .select("id, owner_user_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (!property) return mobileError("Property not found", "NOT_FOUND", 404);

    const { data: payRow, error: payErr } = await admin
      .from("pm_rent_payments")
      .insert({
        invoice_id: invoiceId,
        amount: Math.trunc(amount),
        method,
        recorded_by_user_id: auth.userId,
        note,
      })
      .select("id")
      .single();
    if (payErr) {
      console.error("mobile record payment:", payErr.message);
      return mobileError(payErr.message, "PM_ERROR", 400);
    }

    await recordFeeAndDisburse(admin, {
      rentPaymentId: payRow.id,
      ownerUserId: property.owner_user_id,
      propertyId: property.id,
      grossAmount: Math.trunc(amount),
    });

    const reconciled = await recomputeInvoiceStatus(admin, invoiceId);
    try {
      const { dispatchRentReceipts } = await import("@/lib/pm/rent-fulfillment");
      await dispatchRentReceipts(admin, {
        invoiceId,
        amountKes: Math.trunc(amount),
        mpesaReceipt: null,
        paymentRowId: payRow.id as string,
        amountPaidCumulative: reconciled.amountPaid,
        status: reconciled.status,
      });
    } catch (e) {
      console.warn("[mobile pm] rent receipt dispatch failed:", e);
    }

    return mobileJson({
      apiVersion: "v1",
      success: true,
      paymentId: payRow.id,
      ...reconciled,
    });
  } catch (err) {
    return mapPmError(err);
  }
}

// ── Admin identity verifications ─────────────────────────────────────────────

async function handleAdminListIdentityVerifications(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const { data: rows, error } = await auth.admin
    .from("verifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("mobile admin identity verifications:", error.message);
    return mobileError("Could not load verifications", "ADMIN_ERROR", 500);
  }

  const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await auth.admin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, {
        full_name: (p.full_name as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
      });
    }
  }

  const items = (rows ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    profile: profileMap.get(row.user_id as string) ?? null,
  }));

  return mobileJson({ apiVersion: "v1", items });
}

async function handleAdminPatchIdentityVerification(
  req: Request,
  verificationId: string,
): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    status?: string;
    notes?: string | null;
  }>(req);
  if (body instanceof Response) return body;

  const status = body.status;
  if (!status || !(ID_VERIFY_STATUSES as readonly string[]).includes(status)) {
    return mobileError("status must be approved|rejected", "BAD_REQUEST", 400);
  }

  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

  const { data: row, error } = await auth.admin
    .from("verifications")
    .update({ status, notes })
    .eq("id", verificationId)
    .select("*")
    .single();

  if (error) {
    console.error("mobile admin identity patch:", error.message);
    return mobileError(error.message, "ADMIN_ERROR", 400);
  }

  if (status === "approved") {
    try {
      const { onVerificationApproved } = await import("@/lib/trust/hooks");
      await onVerificationApproved(auth.admin, {
        userId: row.user_id,
        verificationId: row.id,
        verificationType: row.verification_type ?? "identity",
      });
    } catch (e) {
      console.warn("[mobile admin] verification approved hook failed:", e);
    }
  }

  return mobileJson({ apiVersion: "v1", verification: row });
}

/**
 * Wave 7 Mobile BFF — record rent payment + identity verification admin queue.
 */
export async function tryHandleWave7(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const rentPay = /^\/property-management\/properties\/([^/]+)\/rent\/payments$/.exec(rest);
  if (rentPay && method === "POST") {
    const id = parseUuid(rentPay[1]);
    if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    return handleRecordPmPayment(req, id);
  }

  if (rest === "/admin/verifications" && method === "GET") {
    return handleAdminListIdentityVerifications(req);
  }

  const idVerify = /^\/admin\/verifications\/([^/]+)$/.exec(rest);
  if (idVerify && method === "PATCH") {
    const id = parseUuid(idVerify[1]);
    if (!id) return mobileError("Invalid verification id", "BAD_REQUEST", 400);
    return handleAdminPatchIdentityVerification(req, id);
  }

  return null;
}
