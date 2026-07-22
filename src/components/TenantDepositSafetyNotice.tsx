import { AlertTriangle } from "lucide-react";

export const TENANT_DEPOSIT_SAFETY_MESSAGE =
  "DO NOT PAY DEPOSIT BEFORE VISITING THE PROPERTY PHYSICALLY OR CONFIRMING AVAILABILITY";

/** Shown on property detail only — deposit scam prevention. */
export function TenantDepositSafetyNotice() {
  return (
    <div
      role="note"
      className="border-b border-amber-500/35 bg-amber-500/12 px-4 py-2.5 text-center text-[10px] font-bold leading-snug tracking-wide text-amber-950 sm:text-[11px] dark:text-amber-50"
    >
      <AlertTriangle
        className="mr-1.5 inline h-3.5 w-3.5 shrink-0 align-text-bottom text-amber-700 dark:text-amber-200"
        aria-hidden
      />
      {TENANT_DEPOSIT_SAFETY_MESSAGE}
    </div>
  );
}
