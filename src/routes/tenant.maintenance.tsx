import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Wrench, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { FileDropZone } from "@/components/FileDropZone";
import { useAuth } from "@/hooks/use-auth";
import {
  confirmTenantMaintenance,
  createTenantMaintenanceRequest,
  listTenantMaintenanceRequests,
} from "@/lib/api/pm-tenant-maintenance.functions";
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  STATUS_LABELS,
  type MaintenanceCategory,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "@/lib/maintenance/state-machine";
import {
  MAX_MAINTENANCE_PHOTO_MB,
  MAX_MAINTENANCE_PHOTOS,
  uploadMaintenancePhotos,
} from "@/lib/media/upload-maintenance-photos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenant/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — NyumbaSearch" }] }),
  component: TenantMaintenancePage,
});

const CATEGORY_META: Record<MaintenanceCategory, { label: string; icon: string }> = {
  plumbing: { label: "Plumbing", icon: "🚰" },
  electrical: { label: "Electrical", icon: "⚡" },
  security: { label: "Security", icon: "🔒" },
  internet: { label: "Internet", icon: "📶" },
  cleaning: { label: "Cleaning", icon: "🧹" },
  water: { label: "Water supply", icon: "💧" },
  structural: { label: "Structural", icon: "🏗" },
  other: { label: "Other", icon: "📋" },
};

function TenantMaintenancePage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list" | "report">("list");

  const listQ = useQuery({
    queryKey: ["tenant-maintenance", user?.id],
    enabled: Boolean(user),
    queryFn: () => listTenantMaintenanceRequests(),
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="font-display text-2xl font-semibold">Maintenance</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to report issues on your unit.</p>
        <Link to="/auth" className="mt-4 inline-block text-sm font-semibold text-primary">
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Maintenance</h1>
        </div>
        <button
          type="button"
          className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          onClick={() => setMode(mode === "list" ? "report" : "list")}
        >
          {mode === "list" ? "Report an issue" : "Back to list"}
        </button>
      </div>

      {mode === "report" ? (
        <ReportForm
          userId={user.id}
          onDone={() => {
            setMode("list");
            qc.invalidateQueries({ queryKey: ["tenant-maintenance"] });
          }}
        />
      ) : (
        <RequestList
          loading={listQ.isLoading}
          rows={listQ.data ?? []}
          onConfirm={(requestId, resolved) =>
            confirmTenantMaintenance({ data: { requestId, resolved } }).then(() => {
              toast.success(resolved ? "Marked resolved" : "Reopened");
              qc.invalidateQueries({ queryKey: ["tenant-maintenance"] });
            })
          }
        />
      )}
    </div>
  );
}

function ReportForm({
  userId,
  onDone,
}: Readonly<{ userId: string; onDone: () => void }>) {
  const descriptionId = useId();
  const [category, setCategory] = useState<MaintenanceCategory | "">("");
  const [priority, setPriority] = useState<MaintenancePriority>("normal");
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [photoFiles]);

  const create = useMutation({
    mutationFn: async () => {
      let photos: string[] = [];
      if (photoFiles.length) {
        setUploadProgress(0);
        photos = await uploadMaintenancePhotos(userId, photoFiles, setUploadProgress);
      }
      return createTenantMaintenanceRequest({
        data: {
          category: category as MaintenanceCategory,
          priority,
          description,
          photos,
        },
      });
    },
    onSuccess: () => {
      toast.success("Issue reported");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      globalThis.setTimeout(() => setUploadProgress(null), 400);
    },
  });

  function mergePhotos(picked: File[]) {
    const room = MAX_MAINTENANCE_PHOTOS - photoFiles.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_MAINTENANCE_PHOTOS} photos`);
      return;
    }
    const maxBytes = MAX_MAINTENANCE_PHOTO_MB * 1024 * 1024;
    const valid: File[] = [];
    for (const file of picked.slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: not an image`);
        continue;
      }
      if (file.size > maxBytes) {
        toast.error(`${file.name}: max ${MAX_MAINTENANCE_PHOTO_MB}MB`);
        continue;
      }
      valid.push(file);
    }
    if (picked.length > room) {
      toast.error(`Maximum ${MAX_MAINTENANCE_PHOTOS} photos`);
    }
    if (valid.length) setPhotoFiles((prev) => [...prev, ...valid].slice(0, MAX_MAINTENANCE_PHOTOS));
  }

  const busy = create.isPending || uploadProgress !== null;

  let submitLabel = "Report issue";
  if (uploadProgress !== null) submitLabel = `Uploading… ${uploadProgress}%`;
  else if (create.isPending) submitLabel = "Submitting…";

  return (
    <div className="mt-6 space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </p>
        <div className="grid grid-cols-4 gap-2">
          {MAINTENANCE_CATEGORIES.map((id) => {
            const meta = CATEGORY_META[id];
            const active = category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={cn(
                  "rounded-xl border px-1 py-3 text-center transition",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-card hover:border-primary/40",
                )}
              >
                <div className="text-lg" aria-hidden>
                  {meta.icon}
                </div>
                <div className="mt-1 text-[10px] font-semibold leading-tight">{meta.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How urgent is this?
        </p>
        <div className="flex gap-2">
          {MAINTENANCE_PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "flex-1 rounded-lg border py-2 text-xs font-semibold capitalize",
                priority === p
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-border/60",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        {priority === "urgent" ? (
          <p className="mt-2 text-xs text-destructive">
            For emergencies (gas leak, fire, break-in), also call your caretaker directly — don’t
            wait for a response here.
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor={descriptionId}
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Describe the issue
        </label>
        <textarea
          id={descriptionId}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What’s wrong, and when did you first notice it?"
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Photos (optional)
        </p>
        <FileDropZone
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={busy || photoFiles.length >= MAX_MAINTENANCE_PHOTOS}
          uploadProgress={uploadProgress}
          uploadLabel="Uploading photos…"
          title="Add photos of the issue"
          hint={`Up to ${MAX_MAINTENANCE_PHOTOS} · max ${MAX_MAINTENANCE_PHOTO_MB}MB each`}
          icon={<ImageIcon className="h-8 w-8 text-primary sm:h-9 sm:w-9" />}
          onFiles={mergePhotos}
        />
        {photoPreviews.length > 0 ? (
          <PhotoPreviewGrid
            previews={photoPreviews}
            disabled={busy}
            onRemove={(index) =>
              setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
            }
          />
        ) : null}
      </div>

      <button
        type="button"
        disabled={!category || description.trim().length < 8 || busy}
        onClick={() => create.mutate()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}

function PhotoPreviewGrid({
  previews,
  disabled,
  onRemove,
}: Readonly<{
  previews: string[];
  disabled: boolean;
  onRemove: (index: number) => void;
}>) {
  if (!previews.length) return null;
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2">
      {previews.map((src, index) => (
        <li key={src} className="relative aspect-square overflow-hidden rounded-xl border">
          <img src={src} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            disabled={disabled}
            aria-label="Remove photo"
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
            onClick={() => onRemove(index)}
          >
            <X className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ConfirmationActions({
  busy,
  onConfirm,
}: Readonly<{
  busy: boolean;
  onConfirm: (resolved: boolean) => Promise<void>;
}>) {
  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        disabled={busy}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        onClick={() => {
          onConfirm(true).catch((e) => toast.error((e as Error).message));
        }}
      >
        Confirm fixed
      </button>
      <button
        type="button"
        disabled={busy}
        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
        onClick={() => {
          onConfirm(false).catch((e) => toast.error((e as Error).message));
        }}
      >
        Still broken
      </button>
    </div>
  );
}

function RequestList({
  loading,
  rows,
  onConfirm,
}: Readonly<{
  loading: boolean;
  rows: Awaited<ReturnType<typeof listTenantMaintenanceRequests>>;
  onConfirm: (requestId: string, resolved: boolean) => Promise<unknown>;
}>) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No issues reported yet.
      </p>
    );
  }

  async function handleConfirm(requestId: string, resolved: boolean) {
    setBusyId(requestId);
    try {
      await onConfirm(requestId, resolved);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="mt-6 space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-2xl border bg-card p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold capitalize">
                {r.category}
                {r.unit_label ? ` · ${r.unit_label}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">
              {STATUS_LABELS[r.status as MaintenanceStatus] ?? r.status}
            </span>
          </div>
          {r.photos?.length ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {r.photos.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          {r.status === "completed" ? (
            <ConfirmationActions
              busy={busyId === r.id}
              onConfirm={(resolved) => handleConfirm(r.id, resolved)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
