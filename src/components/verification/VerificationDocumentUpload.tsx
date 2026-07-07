import { useRef, type ChangeEvent } from "react";
import { ImageIcon, FileText, X } from "lucide-react";
import { toast } from "sonner";
import {
  type VerificationType,
  VERIFICATION_DOCUMENT_CONFIG,
} from "@/lib/verification/document-config";

type Props = Readonly<{
  verificationType: VerificationType;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VerificationDocumentUpload({ verificationType, files, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const config = VERIFICATION_DOCUMENT_CONFIG[verificationType];

  if (!config.requiresUpload) {
    return (
      <p className="rounded-xl border border-dashed bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
        {config.uploadHint}
      </p>
    );
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;

    const maxBytes = config.maxMb * 1024 * 1024;
    const valid = picked.filter((file) => {
      if (file.size > maxBytes) {
        toast.error(`${file.name}: max ${config.maxMb}MB`);
        return false;
      }
      return true;
    });

    const merged = [...files, ...valid].slice(0, config.maxFiles);
    if (files.length + valid.length > config.maxFiles) {
      toast.error(`Maximum ${config.maxFiles} file(s) for this verification level.`);
    }
    onChange(merged);
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div>
        <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">
          {config.uploadLabel}
        </span>
        <p className="text-[10px] text-muted-foreground">{config.uploadHint}</p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-secondary/20 px-4 py-5 text-center transition hover:bg-secondary/40">
        <ImageIcon className="mb-2 h-5 w-5 text-primary" />
        <span className="text-xs font-semibold">Tap to upload photos or PDFs</span>
        <span className="mt-1 text-[10px] text-muted-foreground">
          Up to {config.maxFiles} file(s) · max {config.maxMb}MB each
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          multiple={config.maxFiles > 1}
          disabled={disabled || files.length >= config.maxFiles}
          className="hidden"
          onChange={onPick}
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => removeAt(index)}
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
