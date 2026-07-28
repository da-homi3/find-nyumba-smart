/**
 * Daily batched rent payouts — group unbatched fee ledger rows by owner + destination.
 * Bank disbursement via IntaSend PesaLink; M-Pesa B2C stubbed until Safaricom product approval.
 */
import type { PmDb } from "@/lib/pm/access";
import { createIntasendBankTransfer, isIntasendConfigured } from "@/lib/pm/intasend-payout";
import {
  pickPayoutDestination,
  prefetchPayoutDestinations,
  type PayoutDestinationRow,
} from "@/lib/pm/payout-destinations";
import { notifyUser } from "@/lib/notifications/notify-user";
import { formatKes } from "@/lib/properties";
import { randomUuid } from "@/lib/random-uuid";

type UnbatchedFee = {
  id: string;
  rent_payment_id: string;
  owner_user_id: string;
  property_id: string;
  gross_amount: number;
  platform_fee: number;
  net_payout_amount: number;
};

type PayoutGroup = {
  ownerUserId: string;
  destination: PayoutDestinationRow;
  fees: UnbatchedFee[];
};

function isLiveBankDestination(destination: PayoutDestinationRow | null): destination is PayoutDestinationRow {
  return destination?.destination_type === "bank_account";
}

function appendFeeToGroup(groups: Map<string, PayoutGroup>, fee: UnbatchedFee, destination: PayoutDestinationRow) {
  const key = `${fee.owner_user_id}:${destination.id}`;
  const existing = groups.get(key);
  if (existing) {
    existing.fees.push(fee);
    return;
  }
  groups.set(key, {
    ownerUserId: fee.owner_user_id,
    destination,
    fees: [fee],
  });
}

export async function runDailyPayoutBatch(admin: PmDb): Promise<{
  batchesCreated: number;
  completed: number;
  failed: number;
  skipped: number;
}> {
  const { data: fees, error } = await admin
    .from("pm_platform_fee_ledger")
    .select(
      "id, rent_payment_id, owner_user_id, property_id, gross_amount, platform_fee, net_payout_amount",
    )
    .is("payout_batch_id", null)
    .order("created_at", { ascending: true })
    .limit(2000);

  if (error) throw error;
  const rows = (fees ?? []) as UnbatchedFee[];
  if (rows.length === 0) {
    return { batchesCreated: 0, completed: 0, failed: 0, skipped: 0 };
  }

  // Group by owner + resolved destination id (one destinations query for all owners)
  const groups = new Map<string, PayoutGroup>();
  const destMap = await prefetchPayoutDestinations(
    admin,
    rows.map((fee) => fee.owner_user_id),
  );

  let skipped = 0;
  for (const fee of rows) {
    const dest = pickPayoutDestination(destMap, fee.owner_user_id, fee.property_id);
    // Only bank payouts are live until Safaricom B2C/B2B is approved
    if (!isLiveBankDestination(dest)) {
      skipped += 1;
      continue;
    }
    appendFeeToGroup(groups, fee, dest);
  }

  let batchesCreated = 0;
  let completed = 0;
  let failed = 0;

  for (const group of groups.values()) {
    const totalGross = group.fees.reduce((s, f) => s + f.gross_amount, 0);
    const totalFee = group.fees.reduce((s, f) => s + f.platform_fee, 0);
    const totalNet = group.fees.reduce((s, f) => s + f.net_payout_amount, 0);
    const paymentIds = group.fees.map((f) => f.rent_payment_id);
    const ledgerIds = group.fees.map((f) => f.id);

    const { data: batch, error: batchErr } = await admin
      .from("pm_payout_batches")
      .insert({
        owner_user_id: group.ownerUserId,
        payout_destination_id: group.destination.id,
        total_gross: totalGross,
        total_platform_fee: totalFee,
        total_net_payout: totalNet,
        rent_payment_ids: paymentIds,
        status: "pending",
      })
      .select("id")
      .single();

    if (batchErr || !batch) {
      console.warn("[payout] batch insert failed:", batchErr?.message);
      failed += 1;
      continue;
    }

    batchesCreated += 1;
    await admin
      .from("pm_platform_fee_ledger")
      .update({ payout_batch_id: batch.id })
      .in("id", ledgerIds);

    const result = await processPayoutBatch(admin, batch.id as string);
    if (result === "completed") completed += 1;
    else failed += 1;
  }

  return { batchesCreated, completed, failed, skipped };
}

export async function processPayoutBatch(
  admin: PmDb,
  batchId: string,
): Promise<"completed" | "failed"> {
  const { data: batch } = await admin
    .from("pm_payout_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) throw new Error("Payout batch not found");

  const { data: destination } = await admin
    .from("pm_payout_destinations")
    .select("*")
    .eq("id", batch.payout_destination_id)
    .maybeSingle();
  if (!destination) throw new Error("Payout destination not found");

  await admin
    .from("pm_payout_batches")
    .update({
      status: "processing",
      attempts: Number(batch.attempts ?? 0) + 1,
    })
    .eq("id", batchId);

  try {
    const providerRef = await disburseToDestination(
      destination as PayoutDestinationRow,
      Number(batch.total_net_payout),
      batchId,
    );

    await admin
      .from("pm_payout_batches")
      .update({
        status: "completed",
        provider_ref: providerRef,
        completed_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq("id", batchId);

    await notifyLandlordPayoutComplete(admin, {
      ownerUserId: batch.owner_user_id as string,
      net: Number(batch.total_net_payout),
      fee: Number(batch.total_platform_fee),
      gross: Number(batch.total_gross),
      batchId,
    });

    return "completed";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout failed";
    await admin
      .from("pm_payout_batches")
      .update({ status: "failed", failure_reason: message })
      .eq("id", batchId);

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: null,
        action: "payout_batch_failed",
        target_id: batchId,
        details: JSON.stringify({ error: message, owner: batch.owner_user_id }),
      });
    } catch {
      // best-effort
    }

    console.error("[payout] batch failed", batchId, message);
    return "failed";
  }
}

async function disburseToDestination(
  destination: PayoutDestinationRow,
  amountKes: number,
  batchId: string,
): Promise<string> {
  if (destination.destination_type === "bank_account") {
    if (!isIntasendConfigured()) {
      throw new Error("IntaSend is not configured for bank payouts");
    }
    if (
      !destination.bank_code ||
      !destination.bank_account_number ||
      !destination.bank_account_name
    ) {
      throw new Error("Bank destination is incomplete");
    }
    const result = await createIntasendBankTransfer({
      accountName: destination.bank_account_name,
      accountNumber: destination.bank_account_number,
      bankCode: destination.bank_code,
      amountKes,
      narration: "NyumbaSearch rent payout",
      batchReference: `nyumba-payout-${batchId.slice(0, 8)}-${randomUuid().slice(0, 8)}`,
    });
    if (!result.ok) throw new Error(result.message);
    return result.transferId;
  }

  throw new Error(
    "M-Pesa payouts require Safaricom B2C/B2B approval — bank payouts are available now",
  );
}

async function notifyLandlordPayoutComplete(
  admin: PmDb,
  opts: {
    ownerUserId: string;
    net: number;
    fee: number;
    gross: number;
    batchId: string;
  },
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await notifyUser(supabaseAdmin, {
    userId: opts.ownerUserId,
    type: "rent",
    title: "Rent payout sent",
    body: `${formatKes(opts.net)} paid out (gross ${formatKes(opts.gross)}, 1% fee ${formatKes(opts.fee)})`,
    href: "/landlord/dashboard/payouts",
    entityType: "payout_batch",
    entityId: opts.batchId,
  });
}
