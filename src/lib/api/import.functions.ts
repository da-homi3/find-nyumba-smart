import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext } from "@/lib/api/server-context";
import { parseCsv, rowsToObjects } from "@/lib/import/csv-parser";
import {
  finalizeValidatedRow,
  validateImportRow,
  type RowValidationError,
  type ValidatedImportRow,
} from "@/lib/import/listing-import";
import { sendEmail } from "@/lib/email/send";
import { baseLayout } from "@/lib/email/base-layout";
import { getSiteUrl } from "@/lib/site";

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

export const previewListingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      csvText: z.string().max(5_000_000),
      filename: z.string().max(200).default("import.csv"),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);

    const rows = rowsToObjects(parseCsv(data.csvText));
    const valid: ValidatedImportRow[] = [];
    const errors: RowValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = validateImportRow(rows[i], i + 2);
      if ("reason" in result) {
        errors.push(result);
      } else {
        valid.push(await finalizeValidatedRow(result));
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hashes = valid.map((r) => r.duplicate_hash);
    let duplicateCount = 0;
    if (hashes.length) {
      const { data: existing } = await supabaseAdmin
        .from("properties")
        .select("duplicate_hash")
        .in("duplicate_hash", hashes);
      const existingSet = new Set((existing ?? []).map((r) => r.duplicate_hash));
      duplicateCount = valid.filter((r) => existingSet.has(r.duplicate_hash)).length;
    }

    return {
      filename: data.filename,
      totalRows: rows.length,
      validCount: valid.length,
      errorCount: errors.length,
      duplicateCount,
      preview: valid.slice(0, 10),
      errors: errors.slice(0, 50),
      rows: valid,
    };
  });

export const executeListingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      filename: z.string(),
      rows: z.array(importRowSchema),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("import_batches")
      .insert({
        user_id: userId,
        filename: data.filename,
        file_type: "csv",
        total_rows: data.rows.length,
        status: "processing",
      })
      .select("id")
      .single();

    if (batchErr || !batch) {
      throw new Error(batchErr?.message ?? "Could not create import batch");
    }

    const propertyIds: string[] = [];
    let imported = 0;
    let failed = 0;
    const rowErrors: RowValidationError[] = [];

    for (const [idx, row] of data.rows.entries()) {
      const { data: property, error } = await supabaseAdmin
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
          owner_id: userId,
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
        propertyIds.push(property.id);
        try {
          const { applyPropertyAreaAnalysis } = await import("@/lib/api/apply-area-analysis");
          await applyPropertyAreaAnalysis(supabaseAdmin, property.id);
        } catch (analysisErr) {
          console.error("[import] area analysis failed:", property.id, analysisErr);
        }
      }
    }

    await supabaseAdmin
      .from("import_batches")
      .update({
        imported_rows: imported,
        failed_rows: failed,
        duplicate_rows: 0,
        status: "complete",
        error_report: rowErrors,
        property_ids: propertyIds,
      })
      .eq("id", batch.id);

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData.user?.email;
    if (email) {
      const body = `
        <h1>Import complete</h1>
        <p><strong>${data.filename}</strong>: ${imported} imported, ${failed} failed.</p>
        <p><a class="btn" href="${getSiteUrl()}/landlord/properties">Review listings</a></p>
      `;
      await sendEmail({
        to: email,
        templateId: "import-complete",
        subject: `Import complete — ${imported} listings`,
        text: `${imported} listings imported from ${data.filename}`,
        html: baseLayout({ preheader: `${imported} listings imported`, body }),
      });
    }

    return { batchId: batch.id, imported, failed, duplicates: 0 };
  });

export const rollbackListingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ batchId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: batch } = await supabaseAdmin
      .from("import_batches")
      .select("*")
      .eq("id", data.batchId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!batch) throw new Error("Import batch not found");

    const created = new Date(batch.created_at).getTime();
    if (Date.now() - created > 24 * 60 * 60 * 1000) {
      throw new Error("Rollback window expired (24 hours)");
    }

    const ids = (batch.property_ids as string[] | null) ?? [];
    if (ids.length) {
      await supabaseAdmin.from("properties").delete().in("id", ids);
    }

    await supabaseAdmin
      .from("import_batches")
      .update({ status: "rolled_back" })
      .eq("id", data.batchId);

    return { rolledBack: ids.length };
  });

export const listMyImportBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("import_batches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  });
