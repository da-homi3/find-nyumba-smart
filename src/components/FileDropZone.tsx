import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type ChangeEvent,
} from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadProgressBar } from "@/components/UploadProgressBar";

export type FileDropZoneProps = Readonly<{
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  title: string;
  hint?: string;
  footnote?: string;
  icon?: ReactNode;
  uploadProgress?: number | null;
  uploadLabel?: string;
  onFiles: (files: File[]) => void;
  className?: string;
  children?: ReactNode;
}>;

export function FileDropZone({
  accept,
  multiple = false,
  disabled = false,
  title,
  hint,
  footnote,
  icon,
  uploadProgress = null,
  uploadLabel = "Uploading…",
  onFiles,
  className,
  children,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  const busy = disabled || uploadProgress !== null;

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length || busy) return;
      onFiles(multiple ? list : list.slice(0, 1));
    },
    [busy, multiple, onFiles],
  );

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    if (busy) return;
    handleFiles(e.dataTransfer.files);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div
      className={cn(
        "file-drop-shell w-full",
        dragActive && !busy && "file-drop-shell--active",
        className,
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <label
        className={cn(
          "file-drop-zone-inner flex min-h-36 w-full cursor-pointer flex-col items-center justify-center rounded-[calc(1rem-2px)] border border-dashed border-muted-foreground/30 bg-secondary/40 px-4 py-6 text-center transition sm:min-h-40 sm:px-6 sm:py-8",
          !busy && "hover:border-primary/40 hover:bg-secondary/55",
          dragActive && !busy && "border-primary/50 bg-primary/5",
          busy && "cursor-not-allowed opacity-90",
        )}
      >
        {uploadProgress !== null ? (
          <UploadProgressBar value={uploadProgress} label={uploadLabel} />
        ) : (
          <>
            {icon ?? <Upload className="h-8 w-8 text-muted-foreground sm:h-9 sm:w-9" />}
            <span className="mt-3 text-sm font-semibold sm:text-base">{title}</span>
            {hint ? (
              <span className="mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">{hint}</span>
            ) : null}
            <span className="mt-2 text-[10px] font-medium uppercase tracking-wide text-primary/80 sm:text-xs">
              {dragActive ? "Release to upload" : "Drag & drop or tap to browse"}
            </span>
            {children}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={busy}
          className="sr-only"
          onChange={onInputChange}
        />
      </label>
      {footnote ? (
        <p className="mt-3 text-xs text-muted-foreground sm:text-sm">{footnote}</p>
      ) : null}
    </div>
  );
}
