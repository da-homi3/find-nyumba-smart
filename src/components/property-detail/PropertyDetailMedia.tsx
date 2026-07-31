import { useState } from "react";
import { Compass, Film } from "lucide-react";
import type { Property } from "@/lib/properties";
import { Panorama360Viewer } from "./Panorama360Viewer";
import {
  externalVideoEmbedUrl,
  isExternalVideoEmbed,
  isLikelyUnsupportedHtml5Video,
  videoMimeFromUrl,
} from "@/lib/media/video-embed";

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

function WalkthroughVideo({
  videoUrl,
  title,
}: Readonly<{ videoUrl: string; title: string }>) {
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
      preload="auto"
      controlsList="nodownload"
      className="aspect-video w-full bg-black object-contain"
      onError={() => setFailed(true)}
    >
      <source src={videoUrl} type={mime ?? "video/mp4"} />
      <track kind="captions" />
    </video>
  );
}

export function PropertyDetailMedia({ property }: PropertyDetailMediaProps) {
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
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Full quality
            </span>
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
            <Panorama360Viewer
              src={tourUrl}
              className="aspect-video w-full cursor-grab bg-muted active:cursor-grabbing"
            />
          )}
          <p className="px-4 py-2 text-[11px] text-muted-foreground">
            Drag to look around the room in 360°.
          </p>
        </section>
      )}
    </div>
  );
}
