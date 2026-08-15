/**
 * Rent payouts — group fee ledger rows by owner + destination, then disburse via IntaSend
 * (bank PesaLink, M-Pesa B2C phone, M-Pesa B2B paybill/till). Instant after collection;
 * daily cron remains as catch-up for failures / missing destinations.
 */
import type { PmDb } from "@/lib/pm/access";
import {
  createIntasendBankTransfer,
  createIntasendMpesaB2B,
  createIntasendMpesaB2C,
  assertIntasendWalletForPayout,
  isIntasendConfigured,
} from "@/lib/pm/intasend-payout";
import {
  pickPayoutDestination,
  prefetchPayoutDestinations,
  resolvePayoutDestination,
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

function appendFeeToGroup(
  groups: Map<string, PayoutGroup>,
  fee: UnbatchedFee,
  destination: PayoutDestinationRow,
) {
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

function belowPayoutMinimum(destination: PayoutDestinationRow, totalNet: number): boolean {
  const isMpesa = String(destination.destination_type).startsWith("mpesa_");
  if (isMpesa) return totalNet < 10;
  if (destination.destination_type === "bank_account") return totalNet < 100;
  return false;
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
    .is("reversed_at", null)
    .order("created_at", { ascending: true })
    .limit(2000);

  if (error) throw error;
  const rows = (fees ?? []) as UnbatchedFee[];
  if (rows.length === 0) {
    return { batchesCreated: 0, completed: 0, failed: 0, skipped: 0 };
  }

  const groups = new Map<string, PayoutGroup>();
  const destMap = await prefetchPayoutDestinations(
    admin,
    rows.map((fee) => fee.owner_user_id),
  );

  let skipped = 0;
  for (const fee of rows) {
    const dest = pickPayoutDestination(destMap, fee.owner_user_id, fee.property_id);
    if (!dest) {
      skipped += 1;
      continue;
    }
    appendFeeToGroup(groups, fee, dest);
  }

  let batchesCreated = 0;
  let completed = 0;
  let failed = 0;

  for (const group of groups.values()) {
    const totalNet = group.fees.reduce((s, f) => s + Number(f.net_payout_amount), 0);
    if (belowPayoutMinimum(group.destination, totalNet)) {
      skipped += 1;
      continue;
    }
    const result = await createAndProcessBatch(admin, group);
    if (result === "created_failed") {
      failed += 1;
      continue;
    }
    batchesCreated += 1;
    if (result === "completed") completed += 1;
    else failed += 1;
  }

  return { batchesCreated, completed, failed, skipped };
}

/**
 * Immediately pay out unbatched rent nets for this owner destination.
 * Includes any other pending ledger rows for the same owner+destination so small
 * payments (e.g. net KES 9) can ride with siblings to meet IntaSend's KES 10 M-Pesa minimum.
 * Safe to call after recordPlatformFee — no-ops if already batched or destination missing.
 */
export async function disburseUnbatchedFeeNow(
  admin: PmDb,
  opts: {
    rentPaymentId: string;
    ownerUserId: string;
    propertyId: string;
  },
): Promise<"completed" | "failed" | "skipped"> {
  const { data: fee, error } = await admin
    .from("pm_platform_fee_ledger")
    .select(
      "id, rent_payment_id, owner_user_id, property_id, gross_amount, platform_fee, net_payout_amount, payout_batch_id, reversed_at",
    )
    .eq("rent_payment_id", opts.rentPaymentId)
    .maybeSingle();

  if (error) {
    console.warn("[payout] fee lookup failed:", error.message);
    return "failed";
  }
  if (!fee || fee.payout_batch_id || fee.reversed_at) return "skipped";
  if (Number(fee.net_payout_amount) <= 0) return "skipped";

  const destination = await resolvePayoutDestination(admin, opts.ownerUserId, opts.propertyId);
  if (!destination) {
    console.warn("[payout] no verified destination for owner", opts.ownerUserId);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await notifyUser(supabaseAdmin, {
        userId: opts.ownerUserId,
        type: "rent",
        title: "Rent received — add a payout method",
        body: `${formatKes(Number(fee.net_payout_amount))} is waiting. Add a verified M-Pesa or bank payout destination to receive it.`,
        href: "/landlord/dashboard/payouts",
        entityType: "rent_payment",
        entityId: opts.rentPaymentId,
      });
    } catch (e) {
      console.warn("[payout] skip-notify failed:", e);
    }
    return "skipped";
  }

  const { data: siblings } = await admin
    .from("pm_platform_fee_ledger")
    .select(
      "id, rent_payment_id, owner_user_id, property_id, gross_amount, platform_fee, net_payout_amount, payout_batch_id",
    )
    .eq("owner_user_id", opts.ownerUserId)
    .is("payout_batch_id", null)
    .is("reversed_at", null)
    .gt("net_payout_amount", 0)
    .order("created_at", { ascending: true })
    .limit(100);

  const siblingRows = (siblings ?? []) as UnbatchedFee[];
  const destMap = await prefetchPayoutDestinations(admin, [opts.ownerUserId]);
  const feesForDest: UnbatchedFee[] = [];
  for (const row of siblingRows) {
    const dest = pickPayoutDestination(destMap, row.owner_user_id, row.property_id);
    if (dest?.id !== destination.id) continue;
    feesForDest.push(row);
  }

  // Always include the triggering fee if somehow missing from the sibling query.
  if (!feesForDest.some((f) => f.id === fee.id)) {
    feesForDest.unshift(fee as UnbatchedFee);
  }

  const totalNet = feesForDest.reduce((s, f) => s + Number(f.net_payout_amount), 0);
  if (belowPayoutMinimum(destination, totalNet)) {
    console.info(
      "[payout] holding below provider minimum (have",
      totalNet,
      ") for owner",
      opts.ownerUserId,
    );
    return "skipped";
  }

  const result = await createAndProcessBatch(admin, {
    ownerUserId: opts.ownerUserId,
    destination,
    fees: feesForDest,
  });

  if (result === "created_failed") return "failed";
  return result;
}

async function createAndProcessBatch(
  admin: PmDb,
  group: PayoutGroup,
): Promise<"completed" | "failed" | "created_failed"> {
  const ledgerIds = group.fees.map((f) => f.id);

  const { data: batch, error: batchErr } = await admin
    .from("pm_payout_batches")
    .insert({
      owner_user_id: group.ownerUserId,
      payout_destination_id: group.destination.id,
      total_gross: 0,
      total_platform_fee: 0,
      total_net_payout: 0,
      rent_payment_ids: [],
      status: "pending",
    })
    .select("id")
    .single();

  if (batchErr || !batch) {
    console.warn("[payout] batch insert failed:", batchErr?.message);
    return "created_failed";
  }

  // Claim the ledger rows atomically. `payout_batch_id IS NULL` makes this a
  // compare-and-set: a concurrent instant payout / daily cron claiming the same
  // fees wins exactly one of them, so the same rent is never disbursed twice.
  const { data: claimed, error: claimErr } = await admin
    .from("pm_platform_fee_ledger")
    .update({ payout_batch_id: batch.id })
    .in("id", ledgerIds)
    .is("payout_batch_id", null)
    .is("reversed_at", null)
    .select("id, rent_payment_id, gross_amount, platform_fee, net_payout_amount");

  const claimedRows = (claimed ?? []) as UnbatchedFee[];

  if (claimErr || claimedRows.length === 0) {
    if (claimErr) console.warn("[payout] ledger claim failed:", claimErr.message);
    await admin
      .from("pm_payout_batches")
      .update({
        status: "cancelled",
        failure_reason: claimErr?.message ?? "Fees already claimed by another payout batch",
      })
      .eq("id", batch.id);
    return claimErr ? "created_failed" : "completed";
  }

  // Totals must reflect what we actually claimed, not what we hoped to claim.
  const totalGross = claimedRows.reduce((s, f) => s + Number(f.gross_amount), 0);
  const totalFee = claimedRows.reduce((s, f) => s + Number(f.platform_fee), 0);
  const totalNet = claimedRows.reduce((s, f) => s + Number(f.net_payout_amount), 0);

  await admin
    .from("pm_payout_batches")
    .update({
      total_gross: totalGross,
      total_platform_fee: totalFee,
      total_net_payout: totalNet,
      rent_payment_ids: claimedRows.map((f) => f.rent_payment_id),
    })
    .eq("id", batch.id);

  return processPayoutBatch(admin, batch.id as string);
}

async function finalizeSentBatch(
  admin: PmDb,
  batch: {
    owner_user_id?: unknown;
    total_net_payout?: unknown;
    total_platform_fee?: unknown;
    total_gross?: unknown;
  },
  batchId: string,
  providerRef: string,
): Promise<"completed"> {
  await admin
    .from("pm_payout_batches")
    .update({
      status: "completed",
      provider_ref: providerRef,
      completed_at: new Date().toISOString(),
      failure_reason: null,
    })
    .eq("id", batchId);

  try {
    await notifyLandlordPayoutComplete(admin, {
      ownerUserId: batch.owner_user_id as string,
      net: Number(batch.total_net_payout),
      fee: Number(batch.total_platform_fee),
      gross: Number(batch.total_gross),
      batchId,
    });
  } catch (e) {
    // The money is out; a failed notification must not roll the batch back.
    console.warn("[payout] completion notify failed:", e);
  }

  return "completed";
}

async function alertOpsWalletLow(
  batchId: string,
  batch: { owner_user_id?: unknown; total_net_payout?: unknown },
  message: string,
) {
  try {
    const { OPS_EMAIL } = await import("@/lib/api/notify");
    const { sendEmail } = await import("@/lib/email/send");
    await sendEmail({
      to: OPS_EMAIL,
      templateId: "ops-payout-wallet-low",
      subject: `IntaSend wallet low — payout ${batchId.slice(0, 8)} delayed`,
      text: `A rent payout of KES ${Number(batch.total_net_payout)} failed because the IntaSend KES wallet is short.\n\n${message}\n\nBatch: ${batchId}\nOwner: ${batch.owner_user_id}\n\nTop up the IntaSend wallet, then the daily PM cron (or manual retry) will send the net to the landlord.`,
      html: `<p>A rent payout of <strong>KES ${Number(batch.total_net_payout)}</strong> failed because the IntaSend KES wallet is short.</p><p>${message}</p><p>Batch <code>${batchId}</code> · Owner <code>${batch.owner_user_id}</code></p><p>Top up the IntaSend wallet, then retry / wait for the PM payout cron.</p>`,
    });
  } catch (e) {
    console.warn("[payout] ops wallet-low email failed:", e);
  }
}

async function finalizeFailedBatch(
  admin: PmDb,
  batch: { owner_user_id?: unknown; total_net_payout?: unknown },
  batchId: string,
  outcome: Extract<DisburseOutcome, { status: "rejected" | "unknown" }>,
): Promise<"failed"> {
  const message = outcome.message;
  const mayHaveSent = outcome.status === "unknown";

  await admin
    .from("pm_payout_batches")
    .update({
      status: mayHaveSent ? "needs_review" : "failed",
      failure_reason: mayHaveSent
        ? `Unconfirmed with provider — verify before retry: ${message}`
        : message,
    })
    .eq("id", batchId);

  if (mayHaveSent) {
    // Transfer may have been accepted before the error. Leave the ledger linked so
    // no cron re-sends it; ops must reconcile against IntaSend and settle manually.
    console.error("[payout] UNCONFIRMED payout, needs manual reconciliation", batchId, message);
    await alertOpsUnconfirmedPayout(batchId, batch, message);
  } else {
    // Provider refused (or we never called it) — safe for catch-up to rebuild a batch.
    await admin
      .from("pm_platform_fee_ledger")
      .update({ payout_batch_id: null })
      .eq("payout_batch_id", batchId);
  }

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

  try {
    await notifyUser((await import("@/integrations/supabase/client.server")).supabaseAdmin, {
      userId: batch.owner_user_id as string,
      type: "rent",
      title: "Rent payout delayed",
      body: mayHaveSent
        ? `${formatKes(Number(batch.total_net_payout))} is being confirmed with our payment provider. We’ll update you as soon as it settles.`
        : `${formatKes(Number(batch.total_net_payout))} is queued after the 1% fee. We’ll retry shortly — ${message.slice(0, 120)}`,
      href: "/landlord/dashboard/payouts",
      entityType: "payout_batch",
      entityId: batchId,
    });
  } catch {
    // best-effort
  }

  if (/insufficient|top up the IntaSend/i.test(message)) {
    await alertOpsWalletLow(batchId, batch, message);
  }

  console.error("[payout] batch failed", batchId, message);
  return "failed";
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

  let outcome: DisburseOutcome;
  try {
    assertDestinationDisbursable(destination as PayoutDestinationRow);
    await assertIntasendWalletForPayout({
      netAmountKes: Number(batch.total_net_payout),
    });
    outcome = await disburseToDestination(
      destination as PayoutDestinationRow,
      Number(batch.total_net_payout),
      batchId,
    );
  } catch (err) {
    // Pre-flight failure: nothing was sent to the provider, so retrying is safe.
    outcome = {
      status: "rejected",
      message: err instanceof Error ? err.message : "Payout failed",
    };
  }

  if (outcome.status === "sent") {
    return finalizeSentBatch(admin, batch, batchId, outcome.providerRef);
  }

  return finalizeFailedBatch(admin, batch, batchId, outcome);
}

/**
 * A payout whose provider outcome is unknown must be reconciled by a human before
 * anyone retries it, so page ops loudly rather than only writing a status column.
 */
async function alertOpsUnconfirmedPayout(
  batchId: string,
  batch: { owner_user_id?: unknown; total_net_payout?: unknown },
  message: string,
): Promise<void> {
  try {
    const { OPS_EMAIL } = await import("@/lib/api/notify");
    const { sendEmail } = await import("@/lib/email/send");
    const net = Number(batch.total_net_payout);
    await sendEmail({
      to: OPS_EMAIL,
      templateId: "ops-payout-unconfirmed",
      subject: `ACTION: unconfirmed payout ${batchId.slice(0, 8)} — check IntaSend before retry`,
      text: `A rent payout of KES ${net} did not return a confirmation from IntaSend.\n\n${message}\n\nBatch: ${batchId}\nOwner: ${batch.owner_user_id}\n\nThe transfer MAY have been accepted. Check the IntaSend dashboard for batch reference nyumba-payout-${batchId.slice(0, 8)} before retrying, otherwise the landlord may be paid twice.`,
      html: `<p>A rent payout of <strong>KES ${net}</strong> did not return a confirmation from IntaSend.</p><p>${message}</p><p>Batch <code>${batchId}</code> · Owner <code>${String(batch.owner_user_id)}</code></p><p><strong>The transfer may have been accepted.</strong> Check IntaSend for reference <code>nyumba-payout-${batchId.slice(0, 8)}</code> before retrying, otherwise the landlord may be paid twice.</p>`,
    });
  } catch (e) {
    console.warn("[payout] ops unconfirmed-payout email failed:", e);
  }
}

/** IntaSend answered and refused the transfer — no money moved, retry is safe. */
class PayoutRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutRejected";
  }
}

async function disburseBank(
  destination: PayoutDestinationRow,
  amountKes: number,
  batchReference: string,
  narration: string,
): Promise<string> {
  const result = await createIntasendBankTransfer({
    accountName: destination.bank_account_name!,
    accountNumber: destination.bank_account_number!,
    bankCode: destination.bank_code!,
    amountKes,
    narration,
    batchReference,
  });
  if (!result.ok) throw new PayoutRejected(result.message);
  return result.transferId;
}

async function disburseMpesaPhone(
  destination: PayoutDestinationRow,
  amountKes: number,
  batchReference: string,
  narration: string,
): Promise<string> {
  const result = await createIntasendMpesaB2C({
    phone254: destination.mpesa_phone!,
    amountKes,
    name: destination.bank_account_name || undefined,
    narration,
    batchReference,
  });
  if (!result.ok) throw new PayoutRejected(result.message);
  return result.transferId;
}

async function disburseMpesaPaybill(
  destination: PayoutDestinationRow,
  amountKes: number,
  batchReference: string,
  narration: string,
): Promise<string> {
  const result = await createIntasendMpesaB2B({
    accountType: "PayBill",
    account: destination.mpesa_paybill_number!,
    accountReference: destination.mpesa_account_number!,
    amountKes,
    narration,
    batchReference,
  });
  if (!result.ok) throw new PayoutRejected(result.message);
  return result.transferId;
}

async function disburseMpesaTill(
  destination: PayoutDestinationRow,
  amountKes: number,
  batchReference: string,
  narration: string,
): Promise<string> {
  const result = await createIntasendMpesaB2B({
    accountType: "TillNumber",
    account: destination.mpesa_till_number!,
    amountKes,
    narration,
    batchReference,
  });
  if (!result.ok) throw new PayoutRejected(result.message);
  return result.transferId;
}

/**
 * Outcome of a provider disbursement.
 *
 * `rejected` means IntaSend answered and refused — no money moved, so a retry is safe.
 * `unknown` means the call threw (timeout, DNS, parse) — the transfer may have been
 * accepted, so the batch must never be silently retried.
 */
type DisburseOutcome =
  | { status: "sent"; providerRef: string }
  | { status: "rejected"; message: string }
  | { status: "unknown"; message: string };

/** Throws for problems we can detect before contacting the provider (safe to retry). */
function assertDestinationDisbursable(destination: PayoutDestinationRow): void {
  if (!isIntasendConfigured()) {
    throw new Error("IntaSend is not configured for payouts");
  }
  switch (destination.destination_type) {
    case "bank_account":
      if (
        !destination.bank_code ||
        !destination.bank_account_number ||
        !destination.bank_account_name
      ) {
        throw new Error("Bank destination is incomplete");
      }
      return;
    case "mpesa_phone":
      if (!destination.mpesa_phone) throw new Error("M-Pesa phone destination is incomplete");
      return;
    case "mpesa_paybill":
      if (!destination.mpesa_paybill_number || !destination.mpesa_account_number) {
        throw new Error("Paybill destination is incomplete");
      }
      return;
    case "mpesa_till":
      if (!destination.mpesa_till_number) throw new Error("Till destination is incomplete");
      return;
    default:
      throw new Error(`Unsupported payout destination type: ${destination.destination_type}`);
  }
}

async function disburseToDestination(
  destination: PayoutDestinationRow,
  amountKes: number,
  batchId: string,
): Promise<DisburseOutcome> {
  const batchReference = `nyumba-payout-${batchId.slice(0, 8)}-${randomUuid().slice(0, 8)}`;
  const narration = "NyumbaSearch rent payout";

  const send = (): Promise<string> => {
    switch (destination.destination_type) {
      case "bank_account":
        return disburseBank(destination, amountKes, batchReference, narration);
      case "mpesa_phone":
        return disburseMpesaPhone(destination, amountKes, batchReference, narration);
      case "mpesa_paybill":
        return disburseMpesaPaybill(destination, amountKes, batchReference, narration);
      default:
        return disburseMpesaTill(destination, amountKes, batchReference, narration);
    }
  };

  try {
    return { status: "sent", providerRef: await send() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout failed";
    // The helpers throw `PayoutRejected` only when IntaSend explicitly refused.
    if (err instanceof PayoutRejected) return { status: "rejected", message };
    return { status: "unknown", message };
  }
}

async function notifyLandlordPayoutComplete(
  _admin: PmDb,
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
