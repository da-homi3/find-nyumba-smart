export type PaymentMetadata = {
  plan?: string;
  boostPackage?: string;
  billingCycle?: string;
  paymentMethod?: string;
  qty?: number;
  propertyAddress?: string;
  listingUrl?: string;
  requesterName?: string;
  requesterPhone?: string;
  requesterEmail?: string;
  verificationTier?: string;
  verificationRequestId?: string;
  reportType?: string;
  providerId?: string;
  successPath?: string;
  cancelPath?: string;
  title?: string;
  renewalSubscriptionId?: string;
  fulfilledAt?: string;
};

const STRING_METADATA_KEYS = [
  "plan",
  "boostPackage",
  "billingCycle",
  "paymentMethod",
  "propertyAddress",
  "listingUrl",
  "requesterName",
  "requesterPhone",
  "requesterEmail",
  "verificationTier",
  "verificationRequestId",
  "reportType",
  "providerId",
  "successPath",
  "cancelPath",
  "title",
  "renewalSubscriptionId",
  "fulfilledAt",
] as const satisfies ReadonlyArray<keyof PaymentMetadata>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePaymentMetadata(raw: unknown): PaymentMetadata {
  if (!isRecord(raw)) return {};

  const result: PaymentMetadata = {};
  for (const key of STRING_METADATA_KEYS) {
    const value = raw[key];
    if (typeof value === "string") result[key] = value;
  }
  if (typeof raw.qty === "number") result.qty = raw.qty;
  return result;
}

export function metadataFromCheckout(data: {
  plan?: string;
  boostPackage?: string;
  billingCycle?: string;
  paymentMethod?: string;
  qty?: number;
  propertyAddress?: string;
  listingUrl?: string;
  requesterName?: string;
  requesterPhone?: string;
  requesterEmail?: string;
  verificationTier?: string;
  verificationRequestId?: string;
  reportType?: string;
  providerId?: string;
  successPath?: string;
  cancelPath?: string;
  title?: string;
  renewalSubscriptionId?: string;
}): PaymentMetadata {
  return { ...data };
}
