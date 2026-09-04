/** Pure scam-report auto-flag rules (no DB). Kept free of createServerFn for unit tests. */

export function isScamAutoFlagged(reason: string, details?: string | null): boolean {
  const lowercaseDetails = (details ?? "").toLowerCase();
  const lowercaseReason = reason.toLowerCase();
  return (
    lowercaseDetails.includes("viewing fee") ||
    lowercaseDetails.includes("pay before") ||
    lowercaseDetails.includes("booking fee") ||
    lowercaseReason.includes("viewing fee")
  );
}

/** Policy: auto-flagged reports create fraud_signals for admin review only. */
export const SCAM_AUTO_FLAG_DEACTIVATES_LISTING = false;
