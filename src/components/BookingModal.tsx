import { useState } from "react";
import { X, Calendar as CalendarIcon, Clock, AlertCircle } from "lucide-react";
import { bookViewing } from "@/lib/api/booking.functions";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface BookingModalProps {
  propertyId: string;
  landlordId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BookingModal({ propertyId, landlordId, isOpen, onClose }: BookingModalProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const booking = useMutation({
    mutationFn: async () => {
      if (!date || !time) throw new Error("Please select a date and time");
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      await bookViewing({
        data: {
          propertyId,
          landlordId,
          scheduledAt,
          notes: notes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Viewing booked successfully! Check your dashboard for updates.");
      qc.invalidateQueries({ queryKey: ["viewings"] });
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-elegant animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-secondary text-muted-foreground"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-display text-xl font-semibold">Book a Viewing</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Schedule a walkthrough with the landlord. No upfront viewing fees are required.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-foreground/80">Select Date</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-foreground/80">Select Time</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-foreground/80">Additional Notes</span>
            <textarea
              placeholder="e.g. Any special request or preferred contact method"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          <div className="rounded-xl bg-amber-500/10 p-3 text-[11px] text-amber-600 dark:text-amber-400 flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Anti-Scam Alert:</strong> Never pay viewing fees before checking out the home in person. Report any landlord asking for viewing fees.
            </span>
          </div>

          <button
            onClick={() => booking.mutate()}
            disabled={booking.isPending}
            className="w-full rounded-xl bg-gradient-emerald py-3 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-90 disabled:opacity-75"
          >
            {booking.isPending ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
