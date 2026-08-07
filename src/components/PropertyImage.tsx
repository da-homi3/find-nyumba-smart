import { useEffect, useState } from "react";
import {
  isBrokenListingImageUrl,
  listingPlaceholderUrl,
  LOCAL_PROPERTY_PLACEHOLDER,
} from "@/lib/property-images";
import { optimizeImageUrlForServeMode } from "@/lib/app-client";

type PropertyImageProps = Readonly<{
  src?: string | null;
  alt: string;
  className?: string;
  seed: string;
  loading?: "lazy" | "eager";
  /** Set high for the LCP image (e.g. first above-the-fold card / hero). */
  fetchPriority?: "high" | "low" | "auto";
}>;

function initialSrc(src: string | null | undefined, seed: string): string {
  const trimmed = src?.trim();
  if (!trimmed || isBrokenListingImageUrl(trimmed)) {
    return listingPlaceholderUrl(seed);
  }
  return optimizeImageUrlForServeMode(trimmed);
}

function photoClass(loaded: boolean, className?: string): string {
  const base = loaded
    ? "property-photo property-photo-loaded"
    : "property-photo property-photo-loading";
  return className ? `${base} ${className}` : base;
}

export function PropertyImage({
  src,
  alt,
  className,
  seed,
  loading = "lazy",
  fetchPriority,
}: PropertyImageProps) {
  const [current, setCurrent] = useState(() => initialSrc(src, seed));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCurrent(initialSrc(src, seed));
    setLoaded(false);
  }, [src, seed]);

  // Eager images are LCP candidates unless the caller overrides.
  const resolvedFetchPriority = fetchPriority ?? (loading === "eager" ? "high" : undefined);

  return (
    <img
      src={current}
      alt={alt}
      width={720}
      height={480}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      loading={loading}
      decoding="async"
      fetchPriority={resolvedFetchPriority}
      className={photoClass(loaded, className)}
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(true);
        setCurrent((prev) =>
          prev === LOCAL_PROPERTY_PLACEHOLDER ? prev : LOCAL_PROPERTY_PLACEHOLDER,
        );
      }}
    />
  );
}
