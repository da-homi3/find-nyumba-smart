import { Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

type AdjustLimit = UseMutationResult<
  { userId: string; listingLimit: number; adminListingLimitOverride: number | null },
  Error,
  { userId: string; delta: number },
  unknown
>;

type ResetLimit = UseMutationResult<
  { userId: string; listingLimit: number; adminListingLimitOverride: number | null },
  Error,
  { userId: string },
  unknown
>;

type Props = Readonly<{
  userId: string;
  listingLimit: number;
  hasOverride: boolean;
  adjustLimit: AdjustLimit;
  resetLimit: ResetLimit;
}>;

export function AdminListingLimitControls({
  userId,
  listingLimit,
  hasOverride,
  adjustLimit,
  resetLimit,
}: Props) {
  const adjustPending = adjustLimit.isPending && adjustLimit.variables?.userId === userId;
  const resetPending = resetLimit.isPending && resetLimit.variables?.userId === userId;
  const pending = adjustPending || resetPending;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <button
        type="button"
        disabled={pending || listingLimit <= 0}
        onClick={() => adjustLimit.mutate({ userId, delta: -1 })}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border hover:bg-secondary disabled:opacity-50"
        aria-label="Decrease listing limit by 1"
      >
        {adjustPending && adjustLimit.variables?.delta === -1 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Minus className="h-3.5 w-3.5" />
        )}
      </button>
      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{listingLimit}</span>
      <button
        type="button"
        disabled={pending || listingLimit >= 9999}
        onClick={() => adjustLimit.mutate({ userId, delta: 1 })}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border hover:bg-secondary disabled:opacity-50"
        aria-label="Increase listing limit by 1"
      >
        {adjustPending && adjustLimit.variables?.delta === 1 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
      </button>
      {hasOverride ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => resetLimit.mutate({ userId })}
          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold hover:bg-secondary disabled:opacity-50"
          title="Reset to plan default"
        >
          {resetPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
          Plan default
        </button>
      ) : null}
    </div>
  );
}
