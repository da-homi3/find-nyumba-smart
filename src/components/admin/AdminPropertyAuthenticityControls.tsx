import { BadgeCheck, Loader2, Minus, Plus } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

export type AdjustAuthenticityVars = {
  propertyId: string;
  delta?: number;
  score?: number;
};

type AdjustScore = UseMutationResult<
  { id: string; title: string; authenticity_score: number },
  Error,
  AdjustAuthenticityVars,
  unknown
>;

type Props = Readonly<{
  propertyId: string;
  score: number;
  disabled?: boolean;
  adjustScore: AdjustScore;
  compact?: boolean;
}>;

export function AdminPropertyAuthenticityControls({
  propertyId,
  score,
  disabled = false,
  adjustScore,
  compact = false,
}: Props) {
  const pending = adjustScore.isPending && adjustScore.variables?.propertyId === propertyId;
  const atMax = score >= 100;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "" : "justify-end"}`}>
      <button
        type="button"
        disabled={disabled || pending || score <= 0}
        onClick={() => adjustScore.mutate({ propertyId, delta: -5 })}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border hover:bg-secondary disabled:opacity-50"
        aria-label="Decrease authenticity score by 5"
      >
        {pending && adjustScore.variables?.delta === -5 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Minus className="h-3.5 w-3.5" />
        )}
      </button>
      <span
        className={`min-w-10 text-center font-semibold tabular-nums ${compact ? "text-xs" : "text-sm"}`}
      >
        {score}%
      </span>
      <button
        type="button"
        disabled={disabled || pending || atMax}
        onClick={() => adjustScore.mutate({ propertyId, delta: 5 })}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border hover:bg-secondary disabled:opacity-50"
        aria-label="Increase authenticity score by 5"
      >
        {pending && adjustScore.variables?.delta === 5 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        type="button"
        disabled={disabled || pending || atMax}
        onClick={() => adjustScore.mutate({ propertyId, score: 100 })}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 text-[11px] font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
        aria-label="Set authenticity score to 100 percent"
        title="Set authenticity to 100%"
      >
        {pending && adjustScore.variables?.score === 100 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <BadgeCheck className="h-3.5 w-3.5" />
        )}
        100%
      </button>
    </div>
  );
}
