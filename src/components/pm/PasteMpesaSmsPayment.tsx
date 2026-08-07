import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { submitPmRentFromSms } from "@/lib/api/pm-tenant-rent.functions";
import { parseMpesaSms } from "@/lib/pm/parse-mpesa-sms";
import { formatKes } from "@/lib/properties";
import { cn } from "@/lib/utils";

export function PasteMpesaSmsPayment({
  invoiceId,
  balanceRemaining,
  onDone,
  onCancel,
}: Readonly<{
  invoiceId: string;
  balanceRemaining: number;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const qc = useQueryClient();
  const [smsText, setSmsText] = useState("");
  const [amountEdit, setAmountEdit] = useState("");

  const parsed = useMemo(() => (smsText.trim() ? parseMpesaSms(smsText) : null), [smsText]);

  const displayAmount = amountEdit ? Number(amountEdit) : (parsed?.amountKes ?? balanceRemaining);

  const amountInputValue = amountEdit || (parsed ? String(parsed.amountKes) : "");
  const recordAmount = Number.isFinite(displayAmount) ? displayAmount : 0;

  let parseFeedback: ReactNode = null;
  if (parsed) {
    const paidAtLabel = parsed.paidAt ? ` · ${parsed.paidAt.toLocaleString()}` : "";
    parseFeedback = (
      <p className={cn("text-xs text-muted-foreground")}>
        Detected receipt <span className="font-semibold">{parsed.receipt}</span>
        {paidAtLabel}
      </p>
    );
  } else if (smsText.trim().length >= 20) {
    parseFeedback = (
      <p className={cn("text-xs text-destructive")}>
        Could not parse yet — paste the full confirmation including the receipt code and Ksh amount.
      </p>
    );
  }

  const submit = useMutation({
    mutationFn: () => {
      const override = amountEdit ? Math.round(Number(amountEdit)) : undefined;
      if (override != null && (!Number.isFinite(override) || override <= 0)) {
        throw new Error("Enter a valid amount");
      }
      return submitPmRentFromSms({
        data: {
          invoiceId,
          smsText: smsText.trim(),
          amountOverride: override,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Recorded ${formatKes(res.amount)} (receipt ${res.receipt}) against your rent`);
      qc.invalidateQueries({ queryKey: ["tenant-pm-invoices"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitLabel = submit.isPending
    ? "Recording…"
    : `Record ${formatKes(recordAmount)} on ledger`;

  return (
    <div className={cn("mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-4")}>
      <h3 className={cn("text-sm font-semibold")}>Paste M-Pesa payment message</h3>
      <p className={cn("text-xs text-muted-foreground")}>
        Copy the Safaricom confirmation SMS and paste it here. We record it automatically on your
        landlord’s rent ledger against this invoice (due {formatKes(balanceRemaining)}).
      </p>
      <label className={cn("block text-xs")}>
        <span className={cn("font-medium")}>M-Pesa message</span>
        <textarea
          value={smsText}
          onChange={(e) => {
            setSmsText(e.target.value);
            const next = parseMpesaSms(e.target.value);
            if (next && !amountEdit) setAmountEdit(String(next.amountKes));
          }}
          rows={5}
          placeholder="e.g. ABC1DE2F3G Confirmed. Ksh2,500.00 sent to…"
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm")}
        />
      </label>
      {parseFeedback}
      <label className={cn("block text-xs")}>
        <span className={cn("font-medium")}>Amount to record (KES)</span>
        <input
          type="number"
          min={1}
          value={amountInputValue}
          onChange={(e) => setAmountEdit(e.target.value)}
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm")}
        />
        {Number.isFinite(displayAmount) && displayAmount !== balanceRemaining ? (
          <span className={cn("mt-1 block text-[11px] text-muted-foreground")}>
            Invoice balance is {formatKes(balanceRemaining)}. Partial payments are OK.
          </span>
        ) : null}
      </label>
      <button
        type="button"
        disabled={submit.isPending || !parsed}
        onClick={() => submit.mutate()}
        className={cn(
          "w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60",
        )}
      >
        {submitLabel}
      </button>
      <button
        type="button"
        className={cn("w-full text-xs text-muted-foreground")}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
