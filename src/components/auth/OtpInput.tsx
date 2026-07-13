import { useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION_DURATION } from "@/lib/design/motion";

const OTP_SLOT_IDS = ["otp-a", "otp-b", "otp-c", "otp-d", "otp-e", "otp-f"] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
};

export function OtpInput({ value, onChange, onComplete, length = 6 }: Readonly<Props>) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value);
  }, [value, length, onComplete]);

  function updateAt(index: number, char: string) {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join("").slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const char = raw.replaceAll(/\D/g, "").slice(-1);
    updateAt(index, char);
    if (char && index < length - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replaceAll(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  }

  return (
    <div className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <motion.input
          key={OTP_SLOT_IDS[index] ?? `otp-extra-${index}`}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          animate={
            digit && !reduceMotion
              ? { borderColor: "var(--color-mint)", scale: [1, 1.08, 1] }
              : { borderColor: "rgba(255,255,255,0.15)", scale: 1 }
          }
          transition={{ duration: MOTION_DURATION.micro }}
          className="h-[52px] w-11 rounded-xl border bg-card text-center text-[22px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-[44px]"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
