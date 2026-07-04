import { useEffect, useState } from "react";
import {
  isBrokenListingImageUrl,
  listingPlaceholderUrl,
  LOCAL_PROPERTY_PLACEHOLDER,
} from "@/lib/property-images";

type PropertyImageProps = Readonly<{
  src?: string | null;
  alt: string;
  className?: string;
  seed: string;
  loading?: "lazy" | "eager";
}>;

function initialSrc(src: string | null | undefined, seed: string): string {
  const trimmed = src?.trim();
  if (!trimmed || isBrokenListingImageUrl(trimmed)) {
    return listingPlaceholderUrl(seed);
  }
  return trimmed;
}

function photoClass(loaded: boolean, className?: string): string {
  const base = loaded ? "property-photo property-photo-loaded" : "property-photo property-photo-loading";
  return className ? `${base} ${className}` : base;
}

export function PropertyImage({ src, alt, className, seed, loading = "lazy" }: PropertyImageProps) {
  const [current, setCurrent] = useState(() => initialSrc(src, seed));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCurrent(initialSrc(src, seed));
    setLoaded(false);
  }, [src, seed]);

  return (
    <img
      src={current}
      alt={alt}
      className={photoClass(loaded, className)}
      loading={loading}
      decoding="async"
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
