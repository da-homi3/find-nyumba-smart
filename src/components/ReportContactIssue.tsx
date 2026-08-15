import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportContactIssue } from "@/lib/api/contact-unlock.functions";
import { errorMessage } from "@/lib/utils";

const REASONS = [
  { value: "number_doesnt_work", label: "Number doesn't work" },
  { value: "property_doesnt_exist", label: "Property doesn't exist" },
  { value: "already_rented", label: "Property already rented" },
  { value: "wrong_contact", label: "Wrong contact information" },
  { value: "suspicious", label: "Suspicious listing" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "other", label: "Other" },
] as const;

type Props = { listingId: string };

export function ReportContactIssue({ listingId }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("number_doesnt_work");
  const [details, setDetails] = useState("");

  const report = useMutation({
    mutationFn: () =>
      reportContactIssue({ data: { listingId, reason, details: details.trim() || undefined } }),
    onSuccess: (res) => {
      toast.success(res.message);
      setOpen(false);
      setDetails("");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="mt-4 text-left">
      <p className="text-xs text-muted-foreground">Something wrong with this contact?</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          Report contact
        </button>
      ) : (
        <form
          className="mt-2 space-y-2 rounded-xl border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate();
          }}
        >
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="block">Reason</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="mt-1 w-full rounded-lg border bg-card px-2 py-2 text-xs"
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="block">Details (optional)</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border bg-card px-2 py-2 text-xs"
            />
          </label>
          <p className="text-[10px] text-muted-foreground">
            If the contact information is invalid, your payment may be refunded according to
            NyumbaSearch&apos;s refund policy. Refunds are reviewed — they are not automatic.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={report.isPending}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {report.isPending ? "Sending…" : "Submit report"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-xs">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
