import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { submitPropertyApplication } from "@/lib/api/rental-application.functions";
import { errorMessage } from "@/lib/utils";
import { useDialogFocusTrap } from "@/hooks/use-dialog-focus-trap";

type RentalApplicationModalProps = Readonly<{
  propertyId: string;
  propertyTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onUnauthorized?: () => void;
  onSubmitted?: () => void;
}>;

export function RentalApplicationModal({
  propertyId,
  propertyTitle,
  isOpen,
  onClose,
  onUnauthorized,
  onSubmitted,
}: RentalApplicationModalProps) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [shareProfile, setShareProfile] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (!isOpen) return;
    setMessage("");
    setMoveInDate("");
    setShareProfile(true);
    setSubmitted(false);
  }, [isOpen, propertyId]);

  const submit = useMutation({
    mutationFn: () =>
      submitPropertyApplication({
        data: {
          propertyId,
          message: message.trim() || undefined,
          moveInDate: moveInDate.trim() || undefined,
          shareProfile,
        },
      }),
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["tenant-applications"] });
      qc.invalidateQueries({ queryKey: ["property-application", propertyId] });
      onSubmitted?.();
      toast.success("Application submitted");
    },
    onError: (err) => {
      const msg = errorMessage(err);
      toast.error(msg);
      if (/sign in|unauthorized|log in/i.test(msg)) onUnauthorized?.();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-dialog-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border bg-background p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Apply to rent
            </p>
            <h2 id="apply-dialog-title" className="font-display text-xl font-semibold">
              {propertyTitle ?? "This property"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-2 hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-3 font-semibold">Application sent</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The landlord will review your profile and message. Track status in My applications.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-xl bg-gradient-emerald px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Share a short note and optional move-in date. Your tenant profile score is attached
              automatically.
            </p>
            <label className="mt-4 block text-[10px] font-semibold uppercase text-muted-foreground">
              Message to landlord
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Tell them why this home fits you, household size, pets, etc."
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm normal-case"
              />
            </label>
            <label className="mt-3 block text-[10px] font-semibold uppercase text-muted-foreground">
              Preferred move-in date
              <input
                type="date"
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm normal-case"
              />
            </label>
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={shareProfile}
                onChange={(e) => setShareProfile(e.target.checked)}
                className="mt-1"
              />
              <span>
                Include my tenant profile score and preferences so the landlord can review faster.
              </span>
            </label>
            <button
              type="button"
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              {submit.isPending ? "Submitting…" : "Submit application"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
