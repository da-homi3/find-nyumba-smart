/** Stable NyumbaSearch receipt number derived from pm_rent_payments.id */
export function nyumbaRentReceiptNo(paymentRowId: string): string {
  return `NS-RENT-${paymentRowId.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}
