import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { createSignedMediaUrls, updatePropertyMedia } from "@/lib/api/media.functions";
import { useAuth } from "@/hooks/use-auth";
import type { Property } from "@/lib/properties";
import { Compass, Film, Image as ImageIcon, Link2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  isWithinUploadLimit,
  MAX_IMAGE_UPLOAD_MB,
  MAX_VIDEO_UPLOAD_MB,
  uploadLimitLabel,
} from "@/lib/media/upload-limits";
import { uploadStorageBatchWithProgress, enhanceAndUploadWithProgress } from "@/lib/media/storage-upload";
import {
  enhanceMediaFilesForUpload,
  enhanceImageForUpload,
  enhanceVideoForUpload,
  isLikelyVideoFile,
} from "@/lib/media/enhance-upload";
import { mapProgressRange, monotonicProgress } from "@/lib/media/progress-range";
import { randomUuid } from "@/lib/random-uuid";
import { FileDropZone } from "@/components/FileDropZone";

type UpdateMediaResult = Awaited<ReturnType<typeof updatePropertyMedia>>;
type MediaKind = "image" | "video" | "tour";

const BUCKET = "property-media";

function mediaPrepareLabel(kind: MediaKind): string {
  if (kind === "image") return "Preparing photos…";
  if (kind === "video") return "Preparing video…";
  return "Preparing 360° image…";
}

function mediaUploadLabel(kind: MediaKind): string {
  if (kind === "image") return "Uploading photos…";
  if (kind === "video") return "Uploading video…";
  return "Uploading 360° image…";
}

/** Ensure iPhone .mov files have a MIME type Storage/players understand. */
function normalizeUploadFile(file: File, kind: MediaKind): File {
  if (kind !== "video") return file;
  const name = file.name.toLowerCase();
  if (file.type && file.type !== "application/octet-stream") return file;
  if (name.endsWith(".mov") || name.endsWith(".qt")) {
    return new File([file], file.name, {
      type: "video/quicktime",
      lastModified: file.lastModified,
    });
  }
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) {
    return new File([file], file.name, { type: "video/mp4", lastModified: file.lastModified });
  }
  if (name.endsWith(".webm")) {
    return new File([file], file.name, { type: "video/webm", lastModified: file.lastModified });
  }
  return file;
}

function buildUploadItems(
  files: File[],
  kind: MediaKind,
  userId: string,
  propertyId: string,
): Array<{ bucket: string; path: string; file: File; kind: MediaKind }> {
  const prefixByKind = { image: "img", video: "video", tour: "tour360" } as const;
  return files.map((file) => {
    const normalized = normalizeUploadFile(file, kind);
    const ext = normalized.name.split(".").pop() ?? (kind === "video" ? "mp4" : "jpg");
    const path = `${userId}/${propertyId}/${prefixByKind[kind]}-${randomUuid()}.${ext}`;
    return { bucket: BUCKET, path, file: normalized, kind };
  });
}

function assignSignedUrls(
  kind: MediaKind,
  uploads: Array<{ kind: MediaKind }>,
  signed: Array<{ path?: string | null; signedUrl?: string | null }>,
  current: { images: string[]; videoUrl: string | null; tourUrl: string | null },
): { images: string[]; videoUrl: string | null; tourUrl: string | null } {
  const newUrls: string[] = [];
  let videoUrl = current.videoUrl;
  let tourUrl = current.tourUrl;

  for (let i = 0; i < uploads.length; i++) {
    const url = signed[i]?.signedUrl;
    if (!url) throw new Error("Could not sign uploaded media");
    const uploadKind = uploads[i]!.kind;
    if (uploadKind === "image") newUrls.push(url);
    else if (uploadKind === "video") videoUrl = url;
    else tourUrl = url;
  }

  return {
    images: kind === "image" ? [...current.images, ...newUrls].slice(0, 15) : current.images,
    videoUrl,
    tourUrl,
  };
}

function isValidMediaFile(file: File, kind: MediaKind): boolean {
  if (kind === "image" || kind === "tour") {
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name}: not an image`);
      return false;
    }
  }
  if (kind === "video" && !isLikelyVideoFile(file)) {
    toast.error(`${file.name}: not a video`);
    return false;
  }
  const limitKind = kind === "tour" ? "image" : kind;
  if (!isWithinUploadLimit(file, limitKind)) {
    toast.error(`${file.name}: max ${uploadLimitLabel(limitKind)}`);
    return false;
  }
  return true;
}

function hasManualWalkthrough(videoUrl: string | null | undefined): boolean {
  const link = videoUrl?.trim() ?? "";
  return Boolean(link);
}

async function maybeGenerateSlideshowVideo(input: {
  userId: string;
  propertyId: string;
  imageUrls: string[];
  videoUrl: string | null;
  onProgress: (percent: number) => void;
}): Promise<string | null> {
  if (hasManualWalkthrough(input.videoUrl)) return null;
  if (input.imageUrls.length === 0) return null;

  const { createSlideshowWalkthrough, fetchImagesForSlideshow, HIGH_QUALITY_SLIDESHOW } =
    await import("@/lib/media/images-to-slideshow");
  const blobs = await fetchImagesForSlideshow(input.imageUrls);
  if (!blobs.length) return null;

  const raw = await createSlideshowWalkthrough(blobs, {
    ...HIGH_QUALITY_SLIDESHOW,
    onProgress: input.onProgress,
  });
  const slideshow = await enhanceVideoForUpload(raw, { onProgress: input.onProgress });
  const uploads = buildUploadItems([slideshow], "video", input.userId, input.propertyId);
  await uploadStorageBatchWithProgress(
    uploads.map(({ bucket, path, file }) => ({ bucket, path, file })),
    input.onProgress,
  );
  const signed = await createSignedMediaUrls({
    data: { paths: uploads.map((item) => item.path) },
  });
  return signed[0]?.signedUrl ?? null;
}

async function attachSlideshowIfNeeded(input: {
  kind: MediaKind;
  userId: string;
  propertyId: string;
  images: string[];
  videoUrl: string | null;
  setLabel: (label: string) => void;
  setProgress: (percent: number) => void;
  setVideoUrl: (url: string) => void;
}): Promise<string | null> {
  if (input.kind !== "image") return input.videoUrl;
  if (hasManualWalkthrough(input.videoUrl) || input.images.length === 0) return input.videoUrl;

  input.setLabel("Creating slideshow walkthrough…");
  // Continue from photo-upload completion (~55%) — never jump back to 0%.
  input.setProgress(55);
  try {
    const generated = await maybeGenerateSlideshowVideo({
      userId: input.userId,
      propertyId: input.propertyId,
      imageUrls: input.images,
      videoUrl: input.videoUrl,
      onProgress: (percent) => input.setProgress(mapProgressRange(percent, 55, 100)),
    });
    if (!generated) return input.videoUrl;
    input.setVideoUrl(generated);
    toast.success("Photo slideshow walkthrough created");
    return generated;
  } catch (err) {
    console.warn("[PropertyMediaManager] slideshow generation failed", err);
    toast.message("Photos saved — slideshow walkthrough could not be generated", {
      description: err instanceof Error ? err.message : "You can upload a video manually.",
    });
    return input.videoUrl;
  }
}

export function PropertyMediaManager({ property }: Readonly<{ property: Property }>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [images, setImages] = useState<string[]>(property.images ?? []);
  const [videoUrl, setVideoUrl] = useState(property.video_url);
  const [tourUrl, setTourUrl] = useState<string | null>(property.tour_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState("Uploading…");

  const save = useMutation({
    mutationFn: (payload: {
      images: string[];
      video_url: string | null;
      tour_url: string | null;
    }) =>
      updatePropertyMedia({
        data: {
          propertyId: property.id,
          images: payload.images,
          video_url: payload.video_url,
          tour_url: payload.tour_url,
          runQualityAnalysis: true,
        },
      }),
    onSuccess: (res: UpdateMediaResult) => {
      if (res.qualityReport) {
        toast.success(`Quality ${res.qualityReport.grade} · ${res.qualityReport.score}/100`, {
          description: res.qualityReport.summary,
        });
      } else {
        toast.success("Media updated");
      }
      void qc.invalidateQueries({ queryKey: ["my-properties-list"] });
      void qc.invalidateQueries({ queryKey: ["manager-properties"] });
      void qc.invalidateQueries({ queryKey: ["agency-properties"] });
      void qc.invalidateQueries({ queryKey: ["my-property-reports"] });
      void qc.invalidateQueries({ queryKey: ["manageable-property", property.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function uploadFiles(files: File[], kind: MediaKind) {
    if (!user) throw new Error("Sign in required");
    setUploading(true);
    setUploadProgress(0);
    setUploadLabel(mediaPrepareLabel(kind));
    let progressFloor: number | null = 0;
    const reportProgress = (percent: number) => {
      progressFloor = monotonicProgress(progressFloor, percent);
      setUploadProgress(progressFloor);
    };

    try {
      // Photos: enhance→upload per file so the first images transfer while others compress.
      // Video/tour keep the prepare-then-upload path (single heavy file / different labels).
      let uploads: Array<{ bucket: string; path: string; file: File; kind: MediaKind }>;

      if (kind === "image") {
        setUploadLabel("Uploading photos…");
        uploads = await enhanceAndUploadWithProgress(
          files,
          enhanceImageForUpload,
          (enhanced) => buildUploadItems([enhanced], "image", user.id, property.id)[0]!,
          (percent) => reportProgress(mapProgressRange(percent, 0, 55)),
        );
      } else {
        const enhanced = await enhanceMediaFilesForUpload(
          files,
          kind === "tour" ? "image" : kind,
          kind === "video"
            ? {
                onProgress: (percent) => {
                  setUploadLabel("Compressing video…");
                  reportProgress(mapProgressRange(percent, 0, 40));
                },
              }
            : undefined,
        );

        setUploadLabel(mediaUploadLabel(kind));
        reportProgress(kind === "video" ? 40 : 5);

        uploads = buildUploadItems(enhanced, kind, user.id, property.id);
        await uploadStorageBatchWithProgress(
          uploads.map(({ bucket, path, file }) => ({ bucket, path, file })),
          (percent) => {
            const from = kind === "video" ? 40 : 5;
            reportProgress(mapProgressRange(percent, from, 100));
          },
        );
      }

      const signed = await createSignedMediaUrls({
        data: { paths: uploads.map((item) => item.path) },
      });
      const next = assignSignedUrls(kind, uploads, signed, {
        images,
        videoUrl,
        tourUrl,
      });

      setImages(next.images);
      if (kind === "video") setVideoUrl(next.videoUrl);
      if (kind === "tour") setTourUrl(next.tourUrl);

      const finalVideoUrl = await attachSlideshowIfNeeded({
        kind,
        userId: user.id,
        propertyId: property.id,
        images: next.images,
        videoUrl: next.videoUrl,
        setLabel: setUploadLabel,
        setProgress: reportProgress,
        setVideoUrl,
      });

      reportProgress(100);
      save.mutate({
        images: next.images,
        video_url: finalVideoUrl,
        tour_url: next.tourUrl,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      globalThis.setTimeout(() => setUploadProgress(null), 400);
    }
  }

  function pickFiles(files: File[], kind: MediaKind) {
    const valid = files.filter((f) => isValidMediaFile(f, kind));
    if (valid.length) void uploadFiles(valid, kind);
  }

  const busy = uploading || save.isPending;

  useBlocker({
    shouldBlockFn: () => {
      if (!busy) return false;
      return !globalThis.confirm(
        "Media is still uploading. Leave this page and cancel the upload?",
      );
    },
    enableBeforeUnload: () => busy,
  });

  useEffect(() => {
    if (!uploading) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        toast.message("Upload still running", {
          id: "property-media-keep-open",
          description: "Keep this tab open until media finishes uploading.",
          duration: 6000,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [uploading]);

  return (
    <div className="mt-4 space-y-4 rounded-xl border bg-background p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Manage media
      </p>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg sm:h-20 sm:w-20">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-0.5 top-0.5 rounded-full bg-foreground/80 p-0.5 text-background"
              onClick={() => {
                const next = images.filter((_, idx) => idx !== i);
                setImages(next);
                save.mutate({ images: next, video_url: videoUrl, tour_url: tourUrl ?? null });
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <FileDropZone
          accept="image/*"
          multiple
          disabled={busy}
          uploadProgress={uploading ? uploadProgress : null}
          uploadLabel={uploadLabel}
          title="Add photos"
          hint={`Up to 15 · max ${MAX_IMAGE_UPLOAD_MB}MB each`}
          icon={<ImageIcon className="h-7 w-7 text-primary sm:h-8 sm:w-8" />}
          onFiles={(files) => pickFiles(files, "image")}
        />
        <FileDropZone
          accept="video/mp4,video/webm,video/quicktime,video/*,.mp4,.webm,.mov"
          disabled={busy}
          uploadProgress={uploading ? uploadProgress : null}
          uploadLabel={uploadLabel}
          title="Walkthrough video"
          hint={`Optional · auto-slideshow from photos if empty · max ${MAX_VIDEO_UPLOAD_MB}MB`}
          icon={<Film className="h-7 w-7 text-primary sm:h-8 sm:w-8" />}
          onFiles={(files) => pickFiles(files, "video")}
        />
        <FileDropZone
          accept="image/*"
          disabled={busy}
          uploadProgress={uploading ? uploadProgress : null}
          uploadLabel={uploadLabel}
          title="360° image"
          hint={`max ${MAX_IMAGE_UPLOAD_MB}MB`}
          icon={<Compass className="h-7 w-7 text-primary sm:h-8 sm:w-8" />}
          onFiles={(files) => pickFiles(files, "tour")}
        />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="url"
            value={videoUrl ?? ""}
            onChange={(e) => setVideoUrl(e.target.value || null)}
            placeholder="Video link (YouTube / Vimeo / MP4)"
            className="w-full rounded-lg border py-1.5 pl-8 pr-2 text-xs"
          />
        </div>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="url"
            value={tourUrl ?? ""}
            onChange={(e) => setTourUrl(e.target.value || null)}
            placeholder="360° tour link (Matterport, etc.)"
            className="w-full rounded-lg border py-1.5 pl-8 pr-2 text-xs"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            save.mutate({ images, video_url: videoUrl, tour_url: tourUrl ?? null });
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Sparkles className="h-3 w-3" />
          Save media & analyze
        </button>
      </div>
    </div>
  );
}
