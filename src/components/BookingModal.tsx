import { useMemo, useState } from "react";
import { X, Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { bookViewing } from "@/lib/api/booking.functions";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const TIME_SLOTS = ["09:00", "11:00", "14:00", "16:00"];
const UNAVAILABLE_SLOTS = new Set(["11:00"]);

interface BookingModalProps {
  propertyId: string;
  landlordId: string;
  propertyTitle?: string;
  propertyAddress?: string;
  isOpen: boolean;
  onClose: () => void;
}

function next14Days() {
  const days: { iso: string; label: string; isSunday: boolean }[] = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      iso: d.toISOString().split("T")[0]!,
      label: d.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" }),
      isSunday: d.getDay() === 0,
    });
  }
  return days;
}

export function BookingModal({
  propertyId,
  landlordId,
  propertyTitle = "this property",
  propertyAddress,
  isOpen,
  onClose,
}: BookingModalProps) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [ref, setRef] = useState("");
  const qc = useQueryClient();
  const days = useMemo(() => next14Days(), []);

  const booking = useMutation({
    mutationFn: async () => {
      if (!date || !time) throw new Error("Please select a date and time");
      const scheduledAt = new Date(`${date}T${time}:00+03:00`).toISOString();
      const row = await bookViewing({
        data: {
          propertyId,
          landlordId,
          scheduledAt,
          notes: notes.trim() || undefined,
        },
      });
      const shortId = row.id.replace(/-/g, "").slice(0, 8).toUpperCase();
      return `NV-${shortId}`;
    },
    onSuccess: (bookingRef) => {
      setRef(bookingRef);
      setStep(4);
      qc.invalidateQueries({ queryKey: ["viewings"] });
      toast.success("Viewing booked!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setStep(1);
    setDate("");
    setTime("");
    setNotes("");
    setRef("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-elegant">
        <button
          onClick={reset}
          className="absolute top-4 right-4 rounded-full p-1 hover:bg-secondary text-muted-foreground"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-display text-xl font-semibold">Book a viewing</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Step {Math.min(step, 3)} of 3 — no viewing fees, no agents.
        </p>

        {step === 1 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">Select a date</p>
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {days.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  disabled={d.isSunday}
                  onClick={() => setDate(d.iso)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${
                    d.isSunday
                      ? "cursor-not-allowed opacity-40"
                      : date === d.iso
                        ? "border-primary bg-primary/10 font-semibold"
                        : "hover:bg-secondary"
                  }`}
                >
                  <CalendarIcon className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                  {d.label}
                  {d.isSunday && <span className="block text-[10px]">Unavailable</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!date}
              onClick={() => setStep(2)}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Next: pick a time
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">Select a time slot</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => {
                const unavailable = UNAVAILABLE_SLOTS.has(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={unavailable}
                    onClick={() => setTime(slot)}
                    className={`rounded-xl border py-3 text-sm font-semibold ${
                      unavailable
                        ? "cursor-not-allowed opacity-40 line-through"
                        : time === slot
                          ? "border-primary bg-primary/10"
                          : "hover:bg-secondary"
                    }`}
                  >
                    <Clock className="mx-auto mb-1 h-4 w-4" />
                    {slot}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!time}
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-secondary p-3 text-sm">
              <p className="font-semibold">{propertyTitle}</p>
              <p className="text-muted-foreground">
                {new Date(`${date}T${time}`).toLocaleString("en-KE")} EAT
              </p>
            </div>
            <label className="block text-xs font-semibold">
              Message to landlord (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
                placeholder="e.g. I'll be with one friend"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={booking.isPending}
                onClick={() => booking.mutate()}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {booking.isPending ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-3 font-display text-lg font-semibold">You're booked!</p>
            <p className="mt-1 text-sm text-muted-foreground">Reference: {ref}</p>
            {propertyAddress && (
              <p className="mt-2 text-xs text-muted-foreground">{propertyAddress}</p>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
