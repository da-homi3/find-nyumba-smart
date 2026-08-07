import { useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION_DURATION } from "@/lib/design/motion";

const OTP_SLOT_IDS = ["otp-a", "otp-b", "otp-c", "otp-d", "otp-e", "otp-f"] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
};

/**
 * Single real input (SMS/WebOTP autofill) with visual digit slots.
 * Split maxLength={1} fields break iOS/Android one-time-code autofill.
 */
export function OtpInput({ value, onChange, onComplete, length = 6 }: Readonly<Props>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const completedForRef = useRef("");
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (value.length !== length || !onComplete) return;
    if (completedForRef.current === value) return;
    completedForRef.current = value;
    onComplete(value);
  }, [value, length, onComplete]);

  useEffect(() => {
    if (value.length < length) completedForRef.current = "";
  }, [value, length]);

  function handleChange(raw: string) {
    const next = raw.replaceAll(/\D/g, "").slice(0, length);
    onChange(next);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        name="one-time-code"
        enterKeyHint="done"
        maxLength={length}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => {
          const len = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(len, len);
        }}
        aria-label="One-time code"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        style={{ fontSize: "16px" }}
      />
      <div className="pointer-events-none flex justify-between gap-2" aria-hidden>
        {digits.map((digit, index) => (
          <motion.div
            key={OTP_SLOT_IDS[index] ?? `otp-extra-${length}-${digit || "empty"}`}
            animate={
              digit && !reduceMotion
                ? { borderColor: "var(--color-mint)", scale: [1, 1.08, 1] }
                : {
                    borderColor:
                      index === value.length ? "var(--color-ring)" : "rgba(255,255,255,0.15)",
                    scale: 1,
                  }
            }
            transition={{ duration: MOTION_DURATION.micro }}
            className="flex h-13 w-11 items-center justify-center rounded-xl border bg-card text-center text-[22px] font-semibold text-foreground sm:w-11"
          >
            {digit}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
