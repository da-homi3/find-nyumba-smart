import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Share2 } from "lucide-react";
import type { Property } from "@/lib/properties";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PropertyImage } from "@/components/PropertyImage";
import { SaveButton } from "@/components/motion/SaveButton";

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

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "100%" : "-100%",
    opacity: 0.85,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? "-100%" : "100%",
    opacity: 0.85,
  }),
};

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
  const slideCount = gallery.length;
  const safeIndex = slideCount > 0 ? Math.min(Math.max(galleryIndex, 0), slideCount - 1) : 0;
  const [direction, setDirection] = useState(0);
  const hasMultiple = slideCount > 1;

  const goTo = useCallback(
    (next: number) => {
      if (slideCount === 0) return;
      const clamped = Math.min(Math.max(next, 0), slideCount - 1);
      if (clamped === safeIndex) return;
      setDirection(clamped > safeIndex ? 1 : -1);
      onGalleryIndexChange(clamped);
    },
    [onGalleryIndexChange, safeIndex, slideCount],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!hasMultiple) return;
      if (event.key === "ArrowLeft") goTo(safeIndex - 1);
      if (event.key === "ArrowRight") goTo(safeIndex + 1);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [goTo, hasMultiple, safeIndex]);

  const currentSrc = slideCount > 0 ? gallery[safeIndex] : undefined;

  return (
    <div className="relative overflow-hidden rounded-b-3xl bg-(--color-obsidian)">
      <div
        className="relative h-[50vh] min-h-[280px] max-h-[560px] w-full overflow-hidden sm:h-[60vh]"
        aria-roledescription="carousel"
        aria-label={`Photos for ${property.title}`}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={safeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            drag={hasMultiple ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50) goTo(safeIndex + 1);
              if (info.offset.x > 50) goTo(safeIndex - 1);
            }}
            className="absolute inset-0 touch-pan-y"
          >
            <PropertyImage
              src={currentSrc}
              seed={`${property.id}-${safeIndex}`}
              alt={
                slideCount > 0
                  ? `${property.title}, photo ${safeIndex + 1} of ${slideCount}`
                  : property.title
              }
              className="h-full w-full object-cover"
              loading="eager"
            />
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-black/40" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-(--color-obsidian) to-transparent" />

        <Link
          to="/tenant"
          aria-label="Back to search"
          className="absolute top-4 left-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>

        <div className="absolute top-16 left-4 z-20 flex max-w-[calc(100%-6rem)] flex-col gap-2">
          {verificationLevel > 0 ? <VerificationBadge level={verificationLevel} /> : null}
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
            <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden />
            Authenticity {authenticityScore}%
          </span>
        </div>

        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <motion.button
            type="button"
            onClick={onShare}
            whileTap={{ scale: 0.9 }}
            aria-label="Share listing"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md"
          >
            <Share2 className="h-4 w-4" aria-hidden />
          </motion.button>
          <SaveButton
            saved={isSaved}
            onToggle={(e) => {
              e.preventDefault();
              onToggleSave();
            }}
            className="border border-white/20"
          />
        </div>

        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={() => goTo(safeIndex - 1)}
              disabled={safeIndex === 0}
              className="absolute top-1/2 left-3 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md disabled:pointer-events-none disabled:opacity-30 sm:left-4"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(safeIndex + 1)}
              disabled={safeIndex === slideCount - 1}
              className="absolute top-1/2 right-3 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md disabled:pointer-events-none disabled:opacity-30 sm:right-4"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>

            <div className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4">
              <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                {safeIndex + 1} / {slideCount}
              </span>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {gallery.map((src, index) => (
                  <motion.button
                    key={`${property.id}-thumb-${index}`}
                    type="button"
                    onClick={() => goTo(index)}
                    animate={{
                      opacity: index === safeIndex ? 1 : 0.55,
                      scale: index === safeIndex ? 1.05 : 1,
                    }}
                    aria-label={`Photo ${index + 1} of ${slideCount}`}
                    aria-current={index === safeIndex ? "true" : undefined}
                    className={`h-8 w-12 shrink-0 overflow-hidden rounded-md border-2 p-0 transition-colors ${
                      index === safeIndex ? "border-[#1eb88a]" : "border-transparent"
                    }`}
                  >
                    <PropertyImage
                      src={src}
                      seed={`${property.id}-thumb-${index}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </motion.button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
