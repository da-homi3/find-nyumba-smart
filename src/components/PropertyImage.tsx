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

export function PropertyImage({
  src,
  alt,
  className,
  seed,
  loading = "lazy",
}: PropertyImageProps) {
  const [current, setCurrent] = useState(() => initialSrc(src, seed));

  useEffect(() => {
    setCurrent(initialSrc(src, seed));
  }, [src, seed]);

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        setCurrent((prev) =>
          prev === LOCAL_PROPERTY_PLACEHOLDER ? prev : LOCAL_PROPERTY_PLACEHOLDER,
        );
      }}
    />
  );
}
