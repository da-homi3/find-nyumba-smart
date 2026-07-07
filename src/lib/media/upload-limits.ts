/** Client-side upload caps for property media (must be ≤ Supabase bucket file_size_limit). */
export const MAX_IMAGE_UPLOAD_MB = 500;
export const MAX_VIDEO_UPLOAD_MB = 900;

export type MediaUploadKind = "image" | "video" | "tour";

export function maxUploadMbForKind(kind: MediaUploadKind): number {
  return kind === "video" ? MAX_VIDEO_UPLOAD_MB : MAX_IMAGE_UPLOAD_MB;
}

export function maxUploadBytesForKind(kind: MediaUploadKind): number {
  return maxUploadMbForKind(kind) * 1024 * 1024;
}

export function isWithinUploadLimit(file: File, kind: MediaUploadKind): boolean {
  return file.size <= maxUploadBytesForKind(kind);
}

export function uploadLimitLabel(kind: MediaUploadKind): string {
  return `${maxUploadMbForKind(kind)}MB`;
}

/** Supabase `property-media` bucket ceiling — matches migration file_size_limit. */
export const PROPERTY_MEDIA_BUCKET_MAX_BYTES = MAX_VIDEO_UPLOAD_MB * 1024 * 1024;
