import type { PmDb } from "@/lib/pm/access";

export type PayoutDestinationType = "mpesa_paybill" | "mpesa_till" | "mpesa_phone" | "bank_account";

export type PayoutDestinationRow = {
  id: string;
  owner_user_id: string;
  property_id: string | null;
  destination_type: PayoutDestinationType;
  mpesa_paybill_number: string | null;
  mpesa_account_number: string | null;
  mpesa_till_number: string | null;
  mpesa_phone: string | null;
  bank_name: string | null;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  verified: boolean;
  is_active: boolean;
};

/** Prefer property-specific destination; fall back to account default. */
export async function resolvePayoutDestination(
  admin: PmDb,
  ownerUserId: string,
  propertyId: string,
): Promise<PayoutDestinationRow | null> {
  const map = await prefetchPayoutDestinations(admin, [ownerUserId]);
  return pickPayoutDestination(map, ownerUserId, propertyId);
}

/**
 * Prefetch verified destinations for many owners in one query (daily payout batch).
 * Returns map: ownerUserId -> { byPropertyId, defaultDest }.
 */
export async function prefetchPayoutDestinations(
  admin: PmDb,
  ownerUserIds: string[],
): Promise<
  Map<
    string,
    { byPropertyId: Map<string, PayoutDestinationRow>; defaultDest: PayoutDestinationRow | null }
  >
> {
  const result = new Map<
    string,
    { byPropertyId: Map<string, PayoutDestinationRow>; defaultDest: PayoutDestinationRow | null }
  >();
  const uniqueOwners = [...new Set(ownerUserIds.filter(Boolean))];
  for (const ownerId of uniqueOwners) {
    result.set(ownerId, { byPropertyId: new Map(), defaultDest: null });
  }
  if (uniqueOwners.length === 0) return result;

  const { data, error } = await admin
    .from("pm_payout_destinations")
    .select("*")
    .in("owner_user_id", uniqueOwners)
    .eq("is_active", true)
    .eq("verified", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  for (const row of (data ?? []) as PayoutDestinationRow[]) {
    const bucket = result.get(row.owner_user_id);
    if (!bucket) continue;
    if (row.property_id) {
      if (!bucket.byPropertyId.has(row.property_id)) {
        bucket.byPropertyId.set(row.property_id, row);
      }
    } else if (!bucket.defaultDest) {
      bucket.defaultDest = row;
    }
  }

  return result;
}

export function pickPayoutDestination(
  map: Awaited<ReturnType<typeof prefetchPayoutDestinations>>,
  ownerUserId: string,
  propertyId: string,
): PayoutDestinationRow | null {
  const bucket = map.get(ownerUserId);
  if (!bucket) return null;
  return bucket.byPropertyId.get(propertyId) ?? bucket.defaultDest;
}

export function namesRoughlyMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replaceAll(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .join(" ");
  return norm(a) === norm(b);
}

/**
 * Kenyan bank codes for IntaSend PesaLink (GET /send-money/bank-codes/ke/).
 * Prefer live fetch via listKenyaBanks when IntaSend is configured.
 */
export const KENYA_BANKS = [
  { name: "KCB Bank Kenya", code: "1" },
  { name: "Standard Chartered", code: "2" },
  { name: "Absa Bank Kenya", code: "3" },
  { name: "NCBA Bank Kenya", code: "7" },
  { name: "Co-operative Bank of Kenya", code: "11" },
  { name: "National Bank of Kenya", code: "12" },
  { name: "Bank of Africa Kenya", code: "19" },
  { name: "Stanbic Bank Kenya", code: "31" },
  { name: "I&M Bank", code: "57" },
  { name: "Diamond Trust Bank", code: "63" },
  { name: "Equity Bank Kenya", code: "68" },
  { name: "Family Bank", code: "70" },
  { name: "Gulf African Bank", code: "72" },
] as const;
