import { useEffect, useState } from "react";
import {
  formatKenyanPhoneDisplay,
  formatKenyanPhoneHint,
  isKenyanPhone,
} from "@/lib/phone";

export type MpesaPhoneMode = "linked" | "other";

type Props = Readonly<{
  /** Valid account phone to offer as the default STK target. */
  linkedPhone?: string | null;
  value: string;
  onChange: (phone: string) => void;
  disabled?: boolean;
  label?: string;
}>;

/**
 * M-Pesa STK target: use the number on the account, or enter another.
 */
export function MpesaPhonePicker({
  linkedPhone,
  value,
  onChange,
  disabled = false,
  label = "M-Pesa number",
}: Props) {
  const hasLinked = Boolean(linkedPhone && isKenyanPhone(linkedPhone));
  const [mode, setMode] = useState<MpesaPhoneMode>(hasLinked ? "linked" : "other");

  useEffect(() => {
    if (!hasLinked) {
      setMode("other");
      return;
    }
    if (value && linkedPhone && isKenyanPhone(value) && normalize(value) === normalize(linkedPhone)) {
      setMode("linked");
    }
  }, [hasLinked, linkedPhone, value]);

  useEffect(() => {
    if (mode === "linked" && linkedPhone && isKenyanPhone(linkedPhone)) {
      if (normalize(value) !== normalize(linkedPhone)) onChange(linkedPhone);
    }
    // Only sync when switching to linked / linked phone arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [mode, linkedPhone]);

  if (!hasLinked) {
    return (
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">{label}</span>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="0712345678"
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none disabled:opacity-60"
          inputMode="tel"
          autoComplete="tel"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {formatKenyanPhoneHint()}
        </span>
      </label>
    );
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1.5 text-xs font-semibold">{label}</legend>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-background px-3 py-2.5">
        <input
          type="radio"
          name="mpesa-phone-mode"
          className="mt-0.5 accent-emerald-600"
          checked={mode === "linked"}
          aria-label={`Use my account number ${formatKenyanPhoneDisplay(linkedPhone!)}`}
          onChange={() => {
            setMode("linked");
            onChange(linkedPhone!);
          }}
        />
        <span className="text-sm">
          <span className="font-medium">Use my account number</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {formatKenyanPhoneDisplay(linkedPhone!)}
          </span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-background px-3 py-2.5">
        <input
          type="radio"
          name="mpesa-phone-mode"
          className="mt-0.5 accent-emerald-600"
          checked={mode === "other"}
          aria-label="Use a different M-Pesa number"
          onChange={() => {
            setMode("other");
            if (normalize(value) === normalize(linkedPhone!)) onChange("");
          }}
        />
        <span className="text-sm font-medium">Use a different M-Pesa number</span>
      </label>

      {mode === "other" ? (
        <input
          type="tel"
          value={normalize(value) === normalize(linkedPhone!) ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="0712345678"
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none disabled:opacity-60"
          inputMode="tel"
          autoComplete="tel"
        />
      ) : null}
    </fieldset>
  );
}

function normalize(phone: string): string {
  return phone.replaceAll(/[\s-]/g, "");
}
