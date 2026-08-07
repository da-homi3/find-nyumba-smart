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
  advertisePackage?: string;
  inquiryId?: string;
  /** PM rent invoice id when payment_type = rent_payment */
  invoiceId?: string;
  successPath?: string;
  cancelPath?: string;
  title?: string;
  renewalSubscriptionId?: string;
  fulfilledAt?: string;
  /** Pesapal order tracking id — used to poll card status without waiting for IPN. */
  orderTrackingId?: string;
  /** Pesapal hosted checkout URL — reused on idempotent retries. */
  cardRedirectUrl?: string;
  /** Which STK provider initiated this M-Pesa payment. */
  mpesaProvider?: "daraja" | "intasend";
  /** Set when rent STK fell back from IntaSend to Daraja. */
  intasendFallbackReason?: string;
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
  "advertisePackage",
  "inquiryId",
  "invoiceId",
  "successPath",
  "cancelPath",
  "title",
  "renewalSubscriptionId",
  "fulfilledAt",
  "orderTrackingId",
  "cardRedirectUrl",
  "mpesaProvider",
  "intasendFallbackReason",
] as const satisfies ReadonlyArray<keyof PaymentMetadata>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePaymentMetadata(raw: unknown): PaymentMetadata {
  if (!isRecord(raw)) return {};

  const result: PaymentMetadata = {};
  for (const key of STRING_METADATA_KEYS) {
    const value = raw[key];
    if (typeof value !== "string") continue;
    if (key === "mpesaProvider") {
      if (value === "daraja" || value === "intasend") result.mpesaProvider = value;
      continue;
    }
    if (key === "intasendFallbackReason") {
      result.intasendFallbackReason = value;
      continue;
    }
    result[key] = value;
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
  advertisePackage?: string;
  inquiryId?: string;
  invoiceId?: string;
  successPath?: string;
  cancelPath?: string;
  title?: string;
  renewalSubscriptionId?: string;
}): PaymentMetadata {
  return { ...data };
}
