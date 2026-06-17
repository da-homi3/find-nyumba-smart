import { useEffect, useMemo, useState } from "react";
import { X, Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { bookViewing } from "@/lib/api/booking.functions";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const TIME_SLOTS = ["09:00", "11:00", "14:00", "16:00"];
const NAIROBI_TZ = "Africa/Nairobi";

interface BookingModalProps {
  propertyId: string;
  propertyTitle?: string;
  propertyAddress?: string;
  isOpen: boolean;
  onClose: () => void;
  onUnauthorized?: () => void;
}

function localDateIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NAIROBI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function isSundayInNairobi(isoDate: string): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: NAIROBI_TZ,
    weekday: "short",
  }).format(new Date(`${isoDate}T12:00:00+03:00`));
  return weekday === "Sun";
}

function formatViewingWhen(date: string, time: string): string {
  return (
    new Intl.DateTimeFormat("en-KE", {
      timeZone: NAIROBI_TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(`${date}T${time}:00+03:00`)) + " EAT"
  );
}

function next14Days() {
  const days: { iso: string; label: string; isSunday: boolean }[] = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const iso = localDateIso(d);
    days.push({
      iso,
      label: d.toLocaleDateString("en-KE", {
        timeZone: NAIROBI_TZ,
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      isSunday: isSundayInNairobi(iso),
    });
  }
  return days;
}

function dateButtonClass(selected: boolean, disabled: boolean): string {
  if (disabled) return "cursor-not-allowed opacity-40";
  if (selected) return "border-primary bg-primary/10 font-semibold";
  return "hover:bg-secondary";
}

function timeButtonClass(selected: boolean): string {
  if (selected) return "border-primary bg-primary/10";
  return "hover:bg-secondary";
}

export function BookingModal({
  propertyId,
  propertyTitle = "this property",
  propertyAddress,
  isOpen,
  onClose,
  onUnauthorized,
}: Readonly<BookingModalProps>) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [ref, setRef] = useState("");
  const qc = useQueryClient();
  const days = useMemo(() => next14Days(), []);

  useEffect(() => {
    if (isOpen) return;
    setStep(1);
    setDate("");
    setTime("");
    setNotes("");
    setRef("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const booking = useMutation({
    mutationFn: async () => {
      if (!date || !time) throw new Error("Please select a date and time");
      if (isSundayInNairobi(date)) {
        throw new Error("Viewings are not available on Sundays. Pick another day.");
      }
      const scheduledAt = `${date}T${time}:00+03:00`;
      const scheduledDate = new Date(scheduledAt);
      if (Number.isNaN(scheduledDate.getTime())) {
        throw new Error("Invalid date or time selected");
      }
      if (scheduledDate.getTime() <= Date.now()) {
        throw new Error("Please choose a future date and time");
      }

      const row = await bookViewing({
        data: {
          propertyId,
          scheduledAt,
          notes: notes.trim() || undefined,
        },
      });
      const shortId = row.id.replaceAll("-", "").slice(0, 8).toUpperCase();
      return `NV-${shortId}`;
    },
    onSuccess: (bookingRef) => {
      setRef(bookingRef);
      setStep(4);
      void qc.invalidateQueries({ queryKey: ["viewings"] });
      toast.success("Viewing booked!");
    },
    onError: (e) => {
      const msg = errorMessage(e);
      if (/unauthorized|sign in/i.test(msg)) {
        onUnauthorized?.();
      }
      toast.error(msg);
    },
  });

  if (!isOpen) return null;

  const stepLabel = step >= 4 ? "Confirmed" : `Step ${step} of 3`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-elegant"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 id="booking-modal-title" className="font-display text-xl font-semibold">
          Book a viewing
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {stepLabel} — no viewing fees, no agents.
        </p>

        {step === 1 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Select a date (Nairobi time)
            </p>
            <div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {days.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  disabled={d.isSunday}
                  onClick={() => setDate(d.iso)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${dateButtonClass(date === d.iso, d.isSunday)}`}
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
            <p className="text-xs font-semibold text-muted-foreground">Select a time slot (EAT)</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={`rounded-xl border py-3 text-sm font-semibold ${timeButtonClass(time === slot)}`}
                >
                  <Clock className="mx-auto mb-1 h-4 w-4" />
                  {slot}
                </button>
              ))}
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
              <p className="text-muted-foreground">{formatViewingWhen(date, time)}</p>
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
            <p className="mt-3 font-display text-lg font-semibold">You&apos;re booked!</p>
            <p className="mt-1 text-sm text-muted-foreground">Reference: {ref}</p>
            {propertyAddress && (
              <p className="mt-2 text-xs text-muted-foreground">{propertyAddress}</p>
            )}
            <button
              type="button"
              onClick={onClose}
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
