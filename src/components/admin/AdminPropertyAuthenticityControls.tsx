import { Loader2, Minus, Plus } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

type AdjustScore = UseMutationResult<
  { id: string; title: string; authenticity_score: number },
  Error,
  { propertyId: string; delta: number },
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

  return (
    <div className={`flex items-center gap-1 ${compact ? "" : "justify-end"}`}>
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
        disabled={disabled || pending || score >= 100}
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
    </div>
  );
}
