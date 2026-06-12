import { Link } from "@tanstack/react-router";
import { ArrowLeft, Flame, Heart, Share2 } from "lucide-react";
import type { Property } from "@/lib/properties";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PropertyImage } from "@/components/PropertyImage";

type PropertyDetailGalleryProps = Readonly<{
  property: Property;
  gallery: string[];
  galleryIndex: number;
  onGalleryIndexChange: (index: number) => void;
  verificationLevel: number;
  authenticityScore: number;
  isSaved: boolean | undefined;
  onShare: () => void;
  onToggleSave: () => void;
}>;

export function PropertyDetailGallery({
  property,
  gallery,
  galleryIndex,
  onGalleryIndexChange,
  verificationLevel,
  authenticityScore,
  isSaved,
  onShare,
  onToggleSave,
}: PropertyDetailGalleryProps) {
  const activeImage = gallery[galleryIndex] ?? gallery[0];

  return (
    <div className="relative">
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted max-h-[500px]">
        <PropertyImage
          src={activeImage}
          seed={`${property.id}-${galleryIndex}`}
          alt={property.title}
          className="h-full w-full object-cover"
          loading="eager"
        />
      </div>
      <Link
        to="/tenant"
        aria-label="Back to search"
        className="absolute top-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-background/95 shadow-soft backdrop-blur"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          type="button"
          onClick={onShare}
          aria-label="Share listing"
          className="grid h-10 w-10 place-items-center rounded-full bg-background/95 shadow-soft backdrop-blur"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          aria-label={isSaved ? "Remove from saved homes" : "Save home"}
          className="grid h-10 w-10 place-items-center rounded-full bg-background/95 shadow-soft backdrop-blur"
        >
          <Heart className={`h-4 w-4 ${isSaved ? "fill-destructive text-destructive" : ""}`} />
        </button>
      </div>
      {gallery.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {gallery.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => onGalleryIndexChange(i)}
              aria-label={`Photo ${i + 1}`}
              className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${i === galleryIndex ? "border-primary" : "border-white/80"}`}
            >
              <PropertyImage
                src={src}
                seed={`${property.id}-thumb-${i}`}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        {verificationLevel > 0 && <VerificationBadge level={verificationLevel} />}
        <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur">
          <Flame className="h-3.5 w-3.5 text-orange-400" /> Authenticity Score: {authenticityScore}%
        </span>
      </div>
    </div>
  );
}
