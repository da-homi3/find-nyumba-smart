import { Flag } from "lucide-react";

type PropertyReportSectionProps = Readonly<{
  reportOpen: boolean;
  reportReason: string;
  reportDetails: string;
  reportSubmitting: boolean;
  onOpen: () => void;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onSubmit: () => void;
}>;

export function PropertyReportSection({
  reportOpen,
  reportReason,
  reportDetails,
  reportSubmitting,
  onOpen,
  onClose,
  onReasonChange,
  onDetailsChange,
  onSubmit,
}: PropertyReportSectionProps) {
  if (!reportOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/5"
      >
        <Flag className="h-3.5 w-3.5" />
        Report suspicious listing
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-destructive/30 bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-destructive">Report suspicious listing</p>
      <label className="block text-xs font-semibold">
        Reason
        <input
          type="text"
          value={reportReason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-semibold">
        Extra details (optional)
        <textarea
          value={reportDetails}
          onChange={(e) => onDetailsChange(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={reportSubmitting}
          className="rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-70"
        >
          {reportSubmitting ? "Submitting…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
