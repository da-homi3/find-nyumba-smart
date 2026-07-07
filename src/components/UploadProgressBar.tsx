import { cn } from "@/lib/utils";

type UploadProgressBarProps = Readonly<{
  value: number;
  label?: string;
  className?: string;
}>;

export function UploadProgressBar({ value, label, className }: UploadProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("w-full max-w-sm space-y-2", className)}>
      {label ? <p className="text-xs font-medium text-muted-foreground">{label}</p> : null}
      <progress
        className="upload-progress-bar h-2.5 w-full"
        value={clamped}
        max={100}
        aria-label={label ?? "Upload progress"}
      />
      <p className="text-center text-xs font-semibold tabular-nums text-primary">{clamped}%</p>
    </div>
  );
}
