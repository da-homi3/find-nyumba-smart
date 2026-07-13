import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Phone } from "lucide-react";
import { MOTION_DURATION } from "@/lib/design/motion";

type WaitingPhase = "sending" | "awaiting_pin" | "confirming";
type WaitingStage = "sent" | "waiting" | "confirming" | "delayed";

type Props = Readonly<{
  phone: string;
  amount: number;
  onResend?: () => void;
  phase?: WaitingPhase;
}>;

function resolveWaitingStage(phase: WaitingPhase, secondsElapsed: number): WaitingStage {
  if (phase === "confirming") return "confirming";
  if (secondsElapsed < 15) return "sent";
  if (secondsElapsed < 45) return "waiting";
  return "delayed";
}

function waitingStatusText(stage: WaitingStage, phone: string, amount: number): string {
  if (stage === "sent") return `Sending M-Pesa request to ${phone}…`;
  if (stage === "waiting") {
    return `Check your phone and enter your PIN — KES ${amount.toLocaleString()}`;
  }
  if (stage === "confirming") return "Confirming payment automatically…";
  return `Still waiting… Didn't get the prompt? You can request it again below.`;
}

export function MpesaWaitingState({ phone, amount, onResend, phase = "awaiting_pin" }: Props) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const t = setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const stage = resolveWaitingStage(phase, secondsElapsed);
  const statusText = waitingStatusText(stage, phone, amount);

  return (
    <div className="mpesa-waiting flex flex-col items-center rounded-2xl border border-dashed border-primary/30 bg-background/80 px-6 py-8 text-center">
      <motion.div
        className="mpesa-phone-icon mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"
        animate={reduceMotion ? undefined : { rotate: [0, -3, 3, -3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
      >
        <Phone className="h-6 w-6" aria-hidden />
      </motion.div>

      <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto block" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="var(--color-mint)"
          strokeWidth="4"
          strokeDasharray={327}
          strokeLinecap="round"
          animate={reduceMotion ? undefined : { strokeDashoffset: [327, 0] }}
          transition={{ duration: 90, ease: "linear", repeat: Infinity }}
          transform="rotate(-90 60 60)"
        />
      </svg>

      <AnimatePresence mode="wait">
        <motion.p
          key={stage}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: MOTION_DURATION.fast }}
          className="mpesa-status-text mt-4 max-w-xs text-sm font-medium"
        >
          {statusText}
        </motion.p>
      </AnimatePresence>

      {stage === "delayed" && onResend ? (
        <button
          type="button"
          onClick={onResend}
          className="mpesa-resend-btn mt-4 rounded-xl border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          Resend STK push
        </button>
      ) : null}
    </div>
  );
}
