import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  confirmPmPaymentClaim,
  disputePmPaymentClaim,
} from "@/lib/api/pm-module.functions";
import { calculatePlatformFee } from "@/lib/pm/platform-fee";
import { formatKes } from "@/lib/properties";

export type PmPaymentClaim = {
  id: string;
  amount_claimed: number;
  method: string;
  paid_on_date: string;
  note: string | null;
  attachment_url: string | null;
  status: string;
  submitted_at: string;
};

export function PaymentClaimCard({
  claim,
  propertyId,
}: Readonly<{ claim: PmPaymentClaim; propertyId: string }>) {
  const qc = useQueryClient();
  const fee = calculatePlatformFee(claim.amount_claimed);

  const confirm = useMutation({
    mutationFn: () => confirmPmPaymentClaim({ data: { claimId: claim.id } }),
    onSuccess: () => {
      toast.success("Payment credited");
      qc.invalidateQueries({ queryKey: ["pm-payment-claims", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-invoices", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dispute = useMutation({
    mutationFn: (reason: string) =>
      disputePmPaymentClaim({ data: { claimId: claim.id, reason } }),
    onSuccess: () => {
      toast.message("Claim disputed — NyumbaSearch will review");
      qc.invalidateQueries({ queryKey: ["pm-payment-claims", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <p className="font-semibold">
        {formatKes(claim.amount_claimed)} — {claim.method.replaceAll("_", " ")}
      </p>
      <p className="text-sm text-muted-foreground">Claimed paid on {claim.paid_on_date}</p>
      {claim.attachment_url ? (
        <a
          href={claim.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-sm font-medium text-primary underline"
        >
          View proof →
        </a>
      ) : null}
      {claim.note ? (
        <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{claim.note}&rdquo;</p>
      ) : null}
      {claim.status === "pending" ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Confirm — credit this payment
            </button>
            <button
              type="button"
              disabled={dispute.isPending}
              onClick={() => {
                const reason = window.prompt(
                  "Why are you disputing this claim? (Goes to NyumbaSearch support)",
                );
                if (!reason?.trim()) return;
                dispute.mutate(reason.trim());
              }}
              className="rounded-lg border border-destructive/50 px-3 py-1.5 text-xs font-semibold text-destructive"
            >
              Dispute
            </button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Confirming credits {formatKes(claim.amount_claimed)} to this tenancy record. A 1%
            platform fee ({formatKes(fee.platformFee)}) applies to your next payout, same as
            M-Pesa-collected rent.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{claim.status}</p>
      )}
    </div>
  );
}
