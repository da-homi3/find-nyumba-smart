import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { uploadStorageBatchWithProgress } from "@/lib/media/storage-upload";
import { enhanceMediaFilesForUpload } from "@/lib/media/enhance-upload";
import { FileDropZone } from "@/components/FileDropZone";

type UpdateMediaResult = Awaited<ReturnType<typeof updatePropertyMedia>>;
type MediaKind = "image" | "video" | "tour";

const BUCKET = "property-media";

function mediaUploadLabel(kind: MediaKind): string {
  if (kind === "image") return "Uploading photos…";
  if (kind === "video") return "Uploading video…";
  return "Uploading 360° image…";
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
    setUploadLabel(mediaUploadLabel(kind));

    try {
      const newUrls: string[] = [];
      let newVideo: string | null = videoUrl;
      let newTour: string | null = tourUrl;

      const prefixByKind = { image: "img", video: "video", tour: "tour360" } as const;
      const enhanced = await enhanceMediaFilesForUpload(files, kind === "tour" ? "image" : kind);
      const uploads = enhanced.map((file) => {
        const ext = file.name.split(".").pop() ?? (kind === "video" ? "mp4" : "jpg");
        const prefix = prefixByKind[kind];
        const path = `${user.id}/${property.id}/${prefix}-${crypto.randomUUID()}.${ext}`;
        return { bucket: BUCKET, path, file, kind };
      });

      await uploadStorageBatchWithProgress(
        uploads.map(({ bucket, path, file }) => ({ bucket, path, file })),
        setUploadProgress,
      );

      const signed = await createSignedMediaUrls({
        data: { paths: uploads.map((item) => item.path) },
      });

      for (let i = 0; i < uploads.length; i++) {
        const url = signed[i]?.signedUrl;
        if (!url) throw new Error("Could not sign uploaded media");
        const uploadKind = uploads[i]!.kind;
        if (uploadKind === "image") newUrls.push(url);
        else if (uploadKind === "video") newVideo = url;
        else newTour = url;
      }

      const nextImages = kind === "image" ? [...images, ...newUrls].slice(0, 15) : images;
      setImages(nextImages);
      if (kind === "video") setVideoUrl(newVideo);
      if (kind === "tour") setTourUrl(newTour);

      save.mutate({
        images: nextImages,
        video_url: newVideo,
        tour_url: newTour,
      });
    } finally {
      setUploading(false);
      globalThis.setTimeout(() => setUploadProgress(null), 400);
    }
  }

  function pickFiles(files: File[], kind: MediaKind) {
    const valid = files.filter((f) => {
      if (kind === "image" || kind === "tour") {
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name}: not an image`);
          return false;
        }
      }
      if (kind === "video" && !f.type.startsWith("video/")) {
        toast.error(`${f.name}: not a video`);
        return false;
      }
      if (!isWithinUploadLimit(f, kind === "tour" ? "image" : kind)) {
        toast.error(`${f.name}: max ${uploadLimitLabel(kind === "tour" ? "image" : kind)}`);
        return false;
      }
      return true;
    });
    if (valid.length) void uploadFiles(valid, kind);
  }

  const busy = uploading || save.isPending;

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
          accept="video/*"
          disabled={busy}
          uploadProgress={uploading ? uploadProgress : null}
          uploadLabel={uploadLabel}
          title="Walkthrough video"
          hint={`max ${MAX_VIDEO_UPLOAD_MB}MB`}
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
            placeholder="Video link (YouTube, etc.)"
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
          onClick={() => save.mutate({ images, video_url: videoUrl, tour_url: tourUrl ?? null })}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Sparkles className="h-3 w-3" />
          Save media & analyze
        </button>
      </div>
    </div>
  );
}
