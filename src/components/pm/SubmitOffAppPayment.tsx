import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { submitPmPaymentClaim } from "@/lib/api/pm-payment-claims.functions";
import { uploadPaymentProof } from "@/lib/media/upload-payment-proof";
import { formatKes } from "@/lib/properties";
import { cn } from "@/lib/utils";

type Method = "cash" | "bank_transfer" | "mpesa_direct_to_landlord" | "other";

export function SubmitOffAppPayment({
  invoiceId,
  defaultAmount,
  onDone,
  onCancel,
}: Readonly<{
  invoiceId: string;
  defaultAmount: number;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(defaultAmount));
  const [method, setMethod] = useState<Method>("cash");
  const [paidOnDate, setPaidOnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in required");
      const kes = Number(amount);
      if (!Number.isFinite(kes) || kes <= 0) throw new Error("Enter a valid amount");

      let attachmentUrl: string | null = null;
      if (file) {
        attachmentUrl = await uploadPaymentProof(user.id, file);
      }

      return submitPmPaymentClaim({
        data: {
          invoiceId,
          amount: Math.round(kes),
          method,
          paidOnDate,
          note: note.trim() || null,
          attachmentUrl,
        },
      });
    },
    onSuccess: () => {
      toast.success("Claim submitted — waiting for landlord confirmation");
      qc.invalidateQueries({ queryKey: ["tenant-pm-invoices"] });
      qc.invalidateQueries({ queryKey: ["tenant-pm-claims"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn("mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-4")}>
      <h3 className={cn("text-sm font-semibold")}>Record a payment made outside the app</h3>
      <p className={cn("text-xs text-muted-foreground")}>
        Paid by cash, bank transfer, or M-Pesa sent directly to your landlord? Add proof so there is
        a clear record on both sides.
      </p>
      <label className={cn("block text-xs")}>
        <span className={cn("font-medium")}>Amount paid (KES)</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm")}
        />
      </label>
      <label className={cn("block text-xs")}>
        <span className={cn("font-medium")}>How did you pay?</span>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm")}
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mpesa_direct_to_landlord">M-Pesa, sent directly to landlord</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className={cn("block text-xs")}>
        <span className={cn("font-medium")}>Date you paid</span>
        <input
          type="date"
          value={paidOnDate}
          onChange={(e) => setPaidOnDate(e.target.value)}
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm")}
        />
      </label>
      <label className={cn("block text-xs")}>
        <span className={cn("font-medium")}>Attach proof (receipt, bank slip, screenshot)</span>
        <input
          type="file"
          accept="image/*,.pdf,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className={cn("mt-1 w-full text-sm")}
        />
      </label>
      <label className={cn("block text-xs")}>
        <span className={cn("font-medium")}>Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm")}
        />
      </label>
      <button
        type="button"
        disabled={submit.isPending}
        onClick={() => submit.mutate()}
        className={cn(
          "w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60",
        )}
      >
        {submit.isPending
          ? "Submitting…"
          : `Submit ${formatKes(Number(amount) || 0)} for confirmation`}
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
