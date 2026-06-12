import { useRef, type KeyboardEvent, type ClipboardEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
};

export function OtpInput({ value, onChange, length = 6 }: Readonly<Props>) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

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
        <input
          key={`otp-slot-${index}`}
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
          className="h-12 w-11 rounded-xl border bg-card text-center text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
