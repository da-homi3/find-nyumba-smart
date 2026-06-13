import { Compass, Film } from "lucide-react";
import type { Property } from "@/lib/properties";
import { Panorama360Viewer } from "./Panorama360Viewer";

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

export function PropertyDetailMedia({ property }: PropertyDetailMediaProps) {
  const hasVideo = Boolean(property.video_url);
  const hasTour = Boolean(property.tour_url?.trim());
  if (!hasVideo && !hasTour) return null;

  const tourUrl = property.tour_url?.trim() ?? "";
  const tourIsEmbed = hasTour && isExternalTourEmbed(tourUrl);
  const videoUrl = property.video_url ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-5 pt-4">
      {hasVideo && (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Film className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-sm font-semibold">Walkthrough video</h2>
          </div>
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black object-contain"
          >
            <track kind="captions" />
          </video>
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
