import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, requireAdmin } from "@/lib/api/mobile/v1/helpers";
import { requireRole } from "@/lib/api/_authz";
import { hashApiKey } from "@/lib/api/v1/router";
import { z } from "zod";

function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Invalid input";
}

const contactSchema = z.object({
  email: z.string().email(),
  message: z.string().trim().min(10).max(5000),
});

const importPreviewSchema = z.object({
  csvText: z.string().max(5_000_000),
  filename: z.string().max(200).default("import.csv"),
});

const importRowSchema = z.object({
  title: z.string(),
  neighborhood: z.string(),
  rent_kes: z.number().int().positive(),
  bedrooms: z.number().int().min(0).max(10),
  bathrooms: z.number().int().min(1),
  property_type: z.string(),
  description: z.string().nullable(),
  contact_phone: z.string().nullable(),
  duplicate_hash: z.string(),
});

const importExecuteSchema = z.object({
  filename: z.string(),
  rows: z.array(importRowSchema),
});

const advertiseInquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(200).optional(),
  email: z.string().email(),
  phone: z.string().trim().min(9).max(20).optional(),
  website: z.string().trim().max(300).optional(),
  packageId: z.string().min(1),
  budget: z.string().optional(),
  message: z.string().trim().min(3).max(5000),
});

async function handleContact(req: Request): Promise<Response> {
  const body = await parseJsonBody<unknown>(req);
  if (body instanceof Response) return body;
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return mobileError(zodMessage(parsed.error), "VALIDATION", 400);

  try {
    const { checkRateLimit } = await import("@/lib/api/rate-limit");
    checkRateLimit(`contact:${parsed.data.email}`);
    const { sendEmailNotification, OPS_EMAIL } = await import("@/lib/api/notify");
    const sent = await sendEmailNotification({
      to: OPS_EMAIL,
      subject: `[NyumbaSearch] Contact form — ${parsed.data.email}`,
      text: `From: ${parsed.data.email}\n\n${parsed.data.message}`,
    });
    if (!sent) {
      return mobileError(
        "Could not send your message right now. Please email us directly.",
        "EMAIL_FAILED",
        502,
      );
    }
    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    console.error("[wave19] contact", err);
    return mobileError("Contact submit failed", "INTERNAL", 500);
  }
}

async function handleImportPreview(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  try {
    await requireRole(auth.admin, auth.userId, ["landlord", "manager", "agency"]);
  } catch {
    return mobileError("Forbidden", "FORBIDDEN", 403);
  }

  const body = await parseJsonBody<unknown>(req);
  if (body instanceof Response) return body;
  const parsed = importPreviewSchema.safeParse(body);
  if (!parsed.success) return mobileError(zodMessage(parsed.error), "VALIDATION", 400);

  const { parseCsv, rowsToObjects } = await import("@/lib/import/csv-parser");
  const { finalizeValidatedRow, validateImportRow } = await import("@/lib/import/listing-import");
  type RowValidationError = import("@/lib/import/listing-import").RowValidationError;
  type ValidatedImportRow = import("@/lib/import/listing-import").ValidatedImportRow;

  const rows = rowsToObjects(parseCsv(parsed.data.csvText));
  const valid: ValidatedImportRow[] = [];
  const errors: RowValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = validateImportRow(rows[i], i + 2);
    if ("reason" in result) errors.push(result);
    else valid.push(await finalizeValidatedRow(result));
  }

  const hashes = valid.map((r) => r.duplicate_hash);
  let duplicateCount = 0;
  if (hashes.length) {
    const { data: existing } = await auth.admin
      .from("properties")
      .select("duplicate_hash")
      .in("duplicate_hash", hashes);
    const existingSet = new Set((existing ?? []).map((r) => r.duplicate_hash));
    duplicateCount = valid.filter((r) => existingSet.has(r.duplicate_hash)).length;
  }

  return mobileJson({
    apiVersion: "v1",
    filename: parsed.data.filename,
    totalRows: rows.length,
    validCount: valid.length,
    errorCount: errors.length,
    duplicateCount,
    preview: valid.slice(0, 10),
    errors: errors.slice(0, 50),
    rows: valid,
  });
}

async function handleImportExecute(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  try {
    await requireRole(auth.admin, auth.userId, ["landlord", "manager", "agency"]);
  } catch {
    return mobileError("Forbidden", "FORBIDDEN", 403);
  }

  const body = await parseJsonBody<unknown>(req);
  if (body instanceof Response) return body;
  const parsed = importExecuteSchema.safeParse(body);
  if (!parsed.success) return mobileError(zodMessage(parsed.error), "VALIDATION", 400);

  const { data: batch, error: batchErr } = await auth.admin
    .from("import_batches")
    .insert({
      user_id: auth.userId,
      filename: parsed.data.filename,
      file_type: "csv",
      total_rows: parsed.data.rows.length,
      status: "processing",
    })
    .select("id")
    .single();

  if (batchErr || !batch) {
    return mobileError(batchErr?.message ?? "Could not create import batch", "INTERNAL", 500);
  }

  let imported = 0;
  let failed = 0;
  const rowErrors: Array<{ rowIndex: number; reason: string }> = [];

  for (const [idx, row] of parsed.data.rows.entries()) {
    const { data: property, error } = await auth.admin
      .from("properties")
      .insert({
        title: row.title,
        neighborhood: row.neighborhood,
        rent_kes: row.rent_kes,
        rent_kes_max: null,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        property_type: row.property_type as never,
        description: row.description,
        contact_phone: row.contact_phone,
        owner_id: auth.userId,
        is_active: false,
        duplicate_hash: row.duplicate_hash,
        import_batch_id: batch.id,
        images: [],
        amenities: [],
      })
      .select("id")
      .single();

    if (error || !property) {
      failed += 1;
      rowErrors.push({ rowIndex: idx + 2, reason: error?.message ?? "Insert failed" });
    } else {
      imported += 1;
      try {
        const { applyPropertyAreaAnalysis } = await import("@/lib/api/apply-area-analysis");
        await applyPropertyAreaAnalysis(auth.admin, property.id);
      } catch (analysisErr) {
        console.error("[wave19 import] area analysis failed:", property.id, analysisErr);
      }
    }
  }

  await auth.admin
    .from("import_batches")
    .update({
      imported_rows: imported,
      failed_rows: failed,
      duplicate_rows: 0,
      status: "complete",
      error_report: rowErrors,
    })
    .eq("id", batch.id);

  return mobileJson({
    apiVersion: "v1",
    batchId: batch.id,
    imported,
    failed,
    errors: rowErrors.slice(0, 50),
  });
}

async function handleIntegrationsList(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  try {
    await requireRole(auth.admin, auth.userId, ["landlord", "manager", "agency", "admin"]);
  } catch {
    return mobileError("Forbidden", "FORBIDDEN", 403);
  }

  const { data, error } = await auth.admin
    .from("integration_api_keys")
    .select("id, name, key_prefix, created_at, revoked_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) return mobileError(error.message, "INTERNAL", 500);
  return mobileJson({ apiVersion: "v1", items: data ?? [] });
}

async function handleIntegrationsCreate(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  try {
    await requireRole(auth.admin, auth.userId, ["landlord", "manager", "agency", "admin"]);
  } catch {
    return mobileError("Forbidden", "FORBIDDEN", 403);
  }

  const body = await parseJsonBody<{ name?: string }>(req);
  if (body instanceof Response) return body;
  const name = body.name?.trim() ?? "";
  if (name.length < 2 || name.length > 80) {
    return mobileError("Name must be 2–80 characters", "VALIDATION", 400);
  }

  const raw = `nsk_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyHash = await hashApiKey(raw);
  const prefix = raw.slice(0, 12);

  const { data: row, error } = await auth.admin
    .from("integration_api_keys")
    .insert({
      user_id: auth.userId,
      name,
      key_prefix: prefix,
      key_hash: keyHash,
      scope: "listings",
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) return mobileError(error.message, "INTERNAL", 500);
  return mobileJson({ apiVersion: "v1", ...row, apiKey: raw });
}

async function handleIntegrationsRevoke(req: Request, keyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  try {
    await requireRole(auth.admin, auth.userId, ["landlord", "manager", "agency", "admin"]);
  } catch {
    return mobileError("Forbidden", "FORBIDDEN", 403);
  }

  const { error } = await auth.admin
    .from("integration_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", auth.userId);
  if (error) return mobileError(error.message, "INTERNAL", 500);
  return mobileJson({ apiVersion: "v1", ok: true });
}

async function handleAdminRevenue(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const { data: payments } = await auth.admin
    .from("payments")
    .select("amount_kes, payment_type, created_at")
    .eq("status", "completed")
    .gte("created_at", sixMonthsAgo.toISOString());

  const monthBuckets = new Map<
    string,
    {
      month: string;
      mrr: number;
      boosts: number;
      verification: number;
      leads: number;
      plus: number;
    }
  >();

  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthBuckets.set(key, {
      month: MONTH_LABELS[d.getMonth()] ?? "",
      mrr: 0,
      boosts: 0,
      verification: 0,
      leads: 0,
      plus: 0,
    });
  }

  for (const p of payments ?? []) {
    const created = new Date(p.created_at);
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    const bucket = monthBuckets.get(key);
    if (!bucket) continue;
    bucket.mrr += p.amount_kes;
    const t = String(p.payment_type ?? "");
    if (t.includes("boost")) bucket.boosts += p.amount_kes;
    else if (t.includes("verif")) bucket.verification += p.amount_kes;
    else if (t.includes("lead")) bucket.leads += p.amount_kes;
    else if (t.includes("plus") || t.includes("landlord_plan") || t.includes("premium")) {
      bucket.plus += p.amount_kes;
    }
  }

  const chart = Array.from(monthBuckets.values());
  const latest = chart.at(-1) ?? {
    month: "",
    mrr: 0,
    boosts: 0,
    verification: 0,
    leads: 0,
    plus: 0,
  };
  const { countActivePlusMembers } = await import("@/lib/revenue/subscription-store");
  const plusMembers = await countActivePlusMembers(auth.admin);

  return mobileJson({
    apiVersion: "v1",
    mrrKes: latest.mrr,
    plusMembers,
    paymentCount: payments?.length ?? 0,
    chart,
    latest,
  });
}

async function handleAdvertisePackages(): Promise<Response> {
  const { ADVERTISE_PACKAGES } = await import("@/lib/revenue/plans");
  return mobileJson({
    apiVersion: "v1",
    items: ADVERTISE_PACKAGES.map((p) => ({
      id: p.id,
      name: p.name,
      priceKes: p.priceKes,
      description: "description" in p ? (p as { description?: string }).description : undefined,
    })),
  });
}

async function handleAdvertiseInquiry(req: Request): Promise<Response> {
  const body = await parseJsonBody<unknown>(req);
  if (body instanceof Response) return body;
  const parsed = advertiseInquirySchema.safeParse(body);
  if (!parsed.success) return mobileError(zodMessage(parsed.error), "VALIDATION", 400);

  try {
    const { checkRateLimit } = await import("@/lib/api/rate-limit");
    checkRateLimit(`inquiry:${parsed.data.email}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail } = await import("@/lib/email/send");
    const { ADVERTISE_PACKAGES } = await import("@/lib/revenue/plans");
    const pkg =
      ADVERTISE_PACKAGES.find((p) => p.id === parsed.data.packageId) ?? ADVERTISE_PACKAGES[0];

    const metadata = {
      package: parsed.data.packageId,
      budget: parsed.data.budget ?? "",
      website: parsed.data.website ?? "",
      contact: parsed.data.email,
    };

    const { data: inserted, error: dbError } = await supabaseAdmin
      .from("partnership_inquiries")
      .insert({
        inquiry_type: "advertise",
        contact_name: parsed.data.name,
        phone: parsed.data.phone ?? "—",
        email: parsed.data.email,
        company: parsed.data.company ?? null,
        subject: `Advertising inquiry — ${parsed.data.company ?? parsed.data.name}`,
        message: parsed.data.message,
        metadata,
      })
      .select("id")
      .maybeSingle();

    if (dbError) {
      console.error("[wave19] advertise insert", dbError);
      return mobileError("Could not store inquiry", "INTERNAL", 500);
    }

    const opsTo = process.env.ADVERTISE_OPS_EMAIL ?? "nyumbasearch101@gmail.com";
    const emailedOps = await sendEmail({
      to: opsTo,
      subject: `[Advertise] ${pkg.name} — ${parsed.data.company ?? parsed.data.name}`,
      text: `From: ${parsed.data.name} <${parsed.data.email}>\nPhone: ${parsed.data.phone ?? "—"}\nPackage: ${pkg.name}\n\n${parsed.data.message}`,
      html: `<p><strong>${parsed.data.name}</strong> (${parsed.data.email})</p><p>${parsed.data.message}</p>`,
      templateId: "partnership-inquiry",
    });

    const firstName = parsed.data.name.split(/\s+/)[0] ?? "there";
    const emailedUser = await sendEmail({
      to: parsed.data.email,
      subject: "NyumbaSearch — advertising inquiry received",
      text: `Hi ${firstName},\n\nWe received your ${pkg.name} inquiry and will reply within 24 hours.\n\nNyumbaSearch`,
      html: `<p>Hi ${firstName},</p><p>We received your <strong>${pkg.name}</strong> inquiry and will reply within 24 hours.</p>`,
      templateId: "advertise-inquiry-ack",
    });

    return mobileJson({
      apiVersion: "v1",
      stored: Boolean(inserted?.id),
      inquiryId: inserted?.id ?? null,
      emailed: Boolean(emailedOps || emailedUser),
    });
  } catch (err) {
    console.error("[wave19] advertise inquiry", err);
    return mobileError(err instanceof Error ? err.message : "Inquiry failed", "INTERNAL", 500);
  }
}

async function handleAdvertisePay(req: Request): Promise<Response> {
  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (body instanceof Response) return body;

  try {
    const { ADVERTISE_PACKAGES, advertisePackagePrice } = await import("@/lib/revenue/plans");
    const packageId = String(body.advertisePackage ?? body.packageId ?? "");
    const pkg = ADVERTISE_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return mobileError("Unknown advertising package", "VALIDATION", 400);

    const amountKes = Number(body.amountKes);
    const expected = advertisePackagePrice(packageId as never);
    if (!Number.isFinite(amountKes) || amountKes !== expected) {
      return mobileError(`Amount must be KES ${expected} for ${pkg.name}`, "VALIDATION", 400);
    }

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@")) return mobileError("Email required", "VALIDATION", 400);

    const auth = await requireMobileBearer(req);
    if (auth instanceof Response) return auth;
    const userId = auth.userId;

    const { initiatePaymentCore } = await import("@/lib/payments/initiate-payment-core");
    const result = await initiatePaymentCore(userId, {
      paymentType: "invoice",
      amountKes,
      method: (body.method as "mpesa_stk" | "card") ?? "mpesa_stk",
      phoneNumber: String(body.phoneNumber ?? ""),
      email,
      name: body.name ? String(body.name) : undefined,
      advertisePackage: packageId,
      inquiryId: body.inquiryId ? String(body.inquiryId) : undefined,
      requesterEmail: email,
      plan: packageId,
    } as never);

    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    console.error("[wave19] advertise pay", err);
    return mobileError(
      err instanceof Error ? err.message : "Payment failed",
      "PAYMENT_FAILED",
      400,
    );
  }
}

/** Wave 19 — close former WEB_FALLBACK gaps: contact, import, integrations, admin revenue, advertise. */
export async function tryHandleWave19(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  if (method === "POST" && rest === "/contact") return handleContact(req);
  if (method === "GET" && rest === "/advertise/packages") return handleAdvertisePackages();
  if (method === "POST" && rest === "/advertise/inquiries") return handleAdvertiseInquiry(req);
  if (method === "POST" && rest === "/advertise/pay") return handleAdvertisePay(req);
  if (method === "POST" && rest === "/listings/import/preview") return handleImportPreview(req);
  if (method === "POST" && rest === "/listings/import/execute") return handleImportExecute(req);
  if (method === "GET" && rest === "/integrations/keys") return handleIntegrationsList(req);
  if (method === "POST" && rest === "/integrations/keys") return handleIntegrationsCreate(req);
  if (method === "POST" && rest.startsWith("/integrations/keys/") && rest.endsWith("/revoke")) {
    const id = rest.slice("/integrations/keys/".length, -"/revoke".length);
    if (id) return handleIntegrationsRevoke(req, id);
  }
  if (method === "GET" && rest === "/admin/revenue") return handleAdminRevenue(req);
  return null;
}
