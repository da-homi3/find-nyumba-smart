import { lazy, Suspense, useState } from "react";
import { Compass, Download, Film, Loader2 } from "lucide-react";
import type { Property } from "@/lib/properties";

// Pulls in three.js (~180KB gzip). Only a minority of listings have a self-hosted 360
// tour, so it must not be in the property-detail bundle that every listing view loads.
const Panorama360Viewer = lazy(() =>
  import("./Panorama360Viewer").then((m) => ({ default: m.Panorama360Viewer })),
);
import {
  externalVideoEmbedUrl,
  isExternalVideoEmbed,
  isLikelyUnsupportedHtml5Video,
  videoMimeFromUrl,
} from "@/lib/media/video-embed";
import { useAuth } from "@/hooks/use-auth";
import { getAdminPropertyMediaDownloads } from "@/lib/api/admin.functions";
import { saveMediaToGallery, saveResultToast } from "@/lib/media/save-media-to-gallery";
import { filenameFromMediaPath, propertyMediaPathFromUrl } from "@/lib/media/property-media-path";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

type PropertyDetailMediaProps = Readonly<{
  property: Property;
}>;

function isExternalTourEmbed(url: string) {
  return /matterport\.com|my\.matterport|kuula\.co|roundme\.com|youtube\.com|youtu\.be|vimeo\.com/i.test(
    url,
  );
}

function matterportEmbedUrl(url: string) {
  const match = /[?&]m=([A-Za-z0-9]+)/.exec(url) ?? /show\/\?m=([A-Za-z0-9]+)/.exec(url);
  if (match?.[1]) return `https://my.matterport.com/show/?m=${match[1]}&play=1`;
  return url;
}

function WalkthroughVideo({ videoUrl, title }: Readonly<{ videoUrl: string; title: string }>) {
  const [failed, setFailed] = useState(false);
  const embedSrc = isExternalVideoEmbed(videoUrl) ? externalVideoEmbedUrl(videoUrl) : null;
  const mime = videoMimeFromUrl(videoUrl);
  const unsupported = !embedSrc && isLikelyUnsupportedHtml5Video(videoUrl);

  if (embedSrc) {
    return (
      <iframe
        src={embedSrc}
        title={`Walkthrough video for ${title}`}
        className="aspect-video w-full border-0 bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
      />
    );
  }

  if (unsupported || failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <p className="text-sm text-white/80">
          {unsupported
            ? "This walkthrough format needs a native player."
            : "This walkthrough couldn’t play in your browser."}
        </p>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open full-quality video
        </a>
      </div>
    );
  }

  return (
    <video
      key={videoUrl}
      controls
      playsInline
      // Walkthroughs are multi-MB; don't spend a mobile data plan before the user hits play.
      preload="none"
      controlsList="nodownload"
      className="aspect-video w-full bg-black object-contain"
      onError={() => setFailed(true)}
    >
      <source src={videoUrl} type={mime ?? "video/mp4"} />
      <track kind="captions" />
    </video>
  );
}

function walkthroughFilename(title: string, videoUrl: string): string {
  const path = propertyMediaPathFromUrl(videoUrl);
  if (path) return filenameFromMediaPath(path, "walkthrough.mp4");
  const slug = title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${slug || "walkthrough"}-walkthrough.mp4`;
}

function AdminWalkthroughDownload({
  propertyId,
  videoUrl,
  title,
}: Readonly<{ propertyId: string; videoUrl: string; title: string }>) {
  const [busy, setBusy] = useState(false);

  if (isExternalVideoEmbed(videoUrl)) return null;

  async function onDownload() {
    setBusy(true);
    try {
      const pack = await getAdminPropertyMediaDownloads({ data: { propertyId } });
      const video = pack.items.find((item) => item.kind === "video");
      const url = video?.url ?? videoUrl;
      const filename = video?.filename ?? walkthroughFilename(title, url);
      const result = await saveMediaToGallery({
        url,
        filename,
        mimeType: videoMimeFromUrl(url),
      });
      toast.success(saveResultToast(result));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDownload()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-muted disabled:opacity-60"
      aria-label="Save walkthrough to gallery"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {busy ? "Saving…" : "Save to gallery"}
    </button>
  );
}

export function PropertyDetailMedia({ property }: PropertyDetailMediaProps) {
  const { isAdmin } = useAuth();
  const hasVideo = Boolean(property.video_url);
  const hasTour = Boolean(property.tour_url?.trim());
  if (!hasVideo && !hasTour) return null;

  const tourUrl = property.tour_url?.trim() ?? "";
  const tourIsEmbed = hasTour && isExternalTourEmbed(tourUrl);
  const videoUrl = property.video_url ?? "";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 sm:px-5">
      {hasVideo && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-display text-sm font-semibold">Walkthrough video</h2>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <AdminWalkthroughDownload
                  propertyId={property.id}
                  videoUrl={videoUrl}
                  title={property.title}
                />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Full quality
              </span>
            </div>
          </div>
          <WalkthroughVideo videoUrl={videoUrl} title={property.title} />
        </section>
      )}

      {hasTour && (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Compass className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-sm font-semibold">360° virtual tour</h2>
          </div>
          {tourIsEmbed ? (
            <iframe
              src={matterportEmbedUrl(tourUrl)}
              title={`360° tour for ${property.title}`}
              className="aspect-video w-full border-0 bg-muted"
              allow="fullscreen; xr-spatial-tracking"
              loading="lazy"
            />
          ) : (
            <Suspense
              fallback={
                <div className="flex aspect-video w-full items-center justify-center bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <Panorama360Viewer
                src={tourUrl}
                className="aspect-video w-full cursor-grab bg-muted active:cursor-grabbing"
              />
            </Suspense>
          )}
          <p className="px-4 py-2 text-[11px] text-muted-foreground">
            Drag to look around the room in 360°.
          </p>
        </section>
      )}
    </div>
  );
}
