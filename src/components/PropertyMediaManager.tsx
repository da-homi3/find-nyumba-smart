import { useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSignedMediaUrls, updatePropertyMedia } from "@/lib/api/media.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Property } from "@/lib/properties";
import { Compass, Film, Image as ImageIcon, Link2, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

const MAX_IMG_MB = 10;
const MAX_VIDEO_MB = 100;

type UpdateMediaResult = Awaited<ReturnType<typeof updatePropertyMedia>>;

export function PropertyMediaManager({ property }: Readonly<{ property: Property }>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [images, setImages] = useState<string[]>(property.images ?? []);
  const [videoUrl, setVideoUrl] = useState(property.video_url);
  const [tourUrl, setTourUrl] = useState<string | null>(property.tour_url ?? null);
  const [uploading, setUploading] = useState(false);

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

  async function uploadFiles(files: File[], kind: "image" | "video" | "tour") {
    if (!user) throw new Error("Sign in required");
    setUploading(true);
    try {
      const newUrls: string[] = [];
      let newVideo: string | null = videoUrl;
      let newTour: string | null = tourUrl;

      for (const file of files) {
        const ext = file.name.split(".").pop() ?? (kind === "video" ? "mp4" : "jpg");
        const prefixByKind = { image: "img", video: "video", tour: "tour360" } as const;
        const prefix = prefixByKind[kind];
        const path = `${user.id}/${property.id}/${prefix}-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("property-media").upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type,
        });
        if (error) throw error;

        const signed = await createSignedMediaUrls({ data: { paths: [path] } });
        const url = signed[0]?.signedUrl;
        if (!url) throw new Error("Could not sign uploaded media");

        if (kind === "image") newUrls.push(url);
        else if (kind === "video") newVideo = url;
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
    }
  }

  function onPick(
    e: ChangeEvent<HTMLInputElement>,
    kind: "image" | "video" | "tour",
    maxMb: number,
  ) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const valid = files.filter((f) => {
      if (f.size > maxMb * 1024 * 1024) {
        toast.error(`${f.name}: max ${maxMb}MB`);
        return false;
      }
      return true;
    });
    if (valid.length) void uploadFiles(valid, kind);
  }

  const busy = uploading || save.isPending;

  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Manage media
      </p>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg">
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
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium">
          <ImageIcon className="h-3.5 w-3.5" />
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => onPick(e, "image", MAX_IMG_MB)}
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium">
          <Film className="h-3.5 w-3.5" />
          Video
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => onPick(e, "video", MAX_VIDEO_MB)}
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium">
          <Compass className="h-3.5 w-3.5" />
          360° image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => onPick(e, "tour", MAX_IMG_MB)}
          />
        </label>
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
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Save media & analyze
        </button>
      </div>
    </div>
  );
}
