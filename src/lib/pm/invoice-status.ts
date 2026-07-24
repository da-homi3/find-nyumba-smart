export type InvoiceStatus = "pending" | "partial" | "paid" | "overdue";

/** Derive invoice status after a payment (ignores overdue — cron owns that). */
export function invoiceStatusAfterPayment(
  amountDue: number,
  amountPaid: number,
  lateFee = 0,
): Exclude<InvoiceStatus, "overdue"> {
  const totalOwed = amountDue + lateFee;
  if (amountPaid <= 0) return "pending";
  if (amountPaid >= totalOwed) return "paid";
  return "partial";
}

export function rentBalanceRemaining(
  amountDue: number,
  amountPaid: number,
  lateFee = 0,
): number {
  return Math.max(0, amountDue + lateFee - amountPaid);
}

/** One-shot late fee from weeks overdue (does not compound on re-runs when already set). */
export function calculateLateFeeKes(
  amountDue: number,
  amountPaid: number,
  dueDateIso: string,
  percentPerWeek: number,
  nowMs = Date.now(),
): number {
  const balance = Math.max(0, amountDue - amountPaid);
  if (balance <= 0 || percentPerWeek <= 0) return 0;
  const dueMs = new Date(`${dueDateIso}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(dueMs) || nowMs <= dueMs) return 0;
  const daysLate = Math.floor((nowMs - dueMs) / 86_400_000);
  const weeksLate = Math.max(1, Math.ceil(daysLate / 7));
  return Math.round(balance * (percentPerWeek / 100) * weeksLate);
}

export function mapPmUnitTypeToListingType(
  unitType: string | null | undefined,
):
  | "bedsitter"
  | "one_bedroom"
  | "two_bedroom"
  | "three_bedroom"
  | "four_bedroom"
  | "commercial" {
  switch (unitType) {
    case "1br":
      return "one_bedroom";
    case "2br":
      return "two_bedroom";
    case "3br":
      return "three_bedroom";
    case "4br+":
      return "four_bedroom";
    case "commercial":
      return "commercial";
    case "bedsitter":
    default:
      return "bedsitter";
  }
}

export function bedroomsForUnitType(unitType: string | null | undefined, bedrooms?: number | null): number {
  if (typeof bedrooms === "number" && bedrooms >= 0) return bedrooms;
  switch (unitType) {
    case "1br":
      return 1;
    case "2br":
      return 2;
    case "3br":
      return 3;
    case "4br+":
      return 4;
    default:
      return 0;
  }
}
