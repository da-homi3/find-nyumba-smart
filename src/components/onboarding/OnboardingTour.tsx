import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { TourStep } from "@/lib/onboarding/types";

const SPOTLIGHT_SHADOW = "0 0 0 9999px rgba(0, 0, 0, 0.55)";

type Rect = { top: number; left: number; width: number; height: number };

function measureTarget(selector: string | undefined): Rect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const pad = 8;
  return {
    top: Math.max(8, box.top - pad),
    left: Math.max(8, box.left - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}

type Props = Readonly<{
  open: boolean;
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}>;

export function OnboardingTour({
  open,
  step,
  stepIndex,
  stepCount,
  onNext,
  onPrev,
  onSkip,
}: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const update = () => setRect(measureTarget(step.target));

    update();
    step.target?.split(",").forEach((sel) => {
      const el = document.querySelector(sel.trim());
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    globalThis.addEventListener("resize", update);
    globalThis.addEventListener("scroll", update, true);
    const interval = globalThis.setInterval(update, 400);

    return () => {
      globalThis.removeEventListener("resize", update);
      globalThis.removeEventListener("scroll", update, true);
      globalThis.clearInterval(interval);
    };
  }, [open, step.target, stepIndex]);

  if (typeof document === "undefined") return null;

  const tooltipStyle: CSSProperties = rect
    ? {
        top: Math.min(rect.top + rect.height + 12, globalThis.innerHeight - 220),
        left: Math.min(Math.max(16, rect.left), globalThis.innerWidth - 320),
        maxWidth: 300,
      }
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: 340,
        width: "min(340px, calc(100vw - 32px))",
      };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label="Product tour"
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-transparent"
      onCancel={(e) => {
        e.preventDefault();
        onSkip();
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/55 p-0"
        onClick={onSkip}
        aria-label="Skip tour"
      />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: SPOTLIGHT_SHADOW,
          }}
        />
      ) : null}
      <div className="absolute z-10 rounded-2xl border bg-card p-5 shadow-2xl" style={tooltipStyle}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Step {stepIndex + 1} of {stepCount}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={onPrev}
                className="rounded-xl border px-3 py-2 text-xs font-semibold"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNext}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              {stepIndex + 1 >= stepCount ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
