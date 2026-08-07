/**
 * Client-side upload caps for property media.
 *
 * Picker allows large walkthroughs; oversized files are compressed to
 * VIDEO_UPLOAD_TARGET_BYTES before upload (Free-plan Storage hard cap is 50MB).
 * After upgrading Supabase to Pro, raise VIDEO_STORAGE_HARD_CAP_MB to 900.
 */
export const MAX_IMAGE_UPLOAD_MB = 500;
/** Max size the file picker accepts (before auto-compress). */
export const MAX_VIDEO_UPLOAD_MB = 900;
/**
 * Size we actually upload to Storage. Free plan global limit is 50MB —
 * larger clips are compressed client-side to fit.
 */
export const VIDEO_STORAGE_HARD_CAP_MB = 50;
/** Leave a little headroom under the hard cap for container overhead. */
export const VIDEO_UPLOAD_TARGET_BYTES = Math.floor(VIDEO_STORAGE_HARD_CAP_MB * 1024 * 1024 * 0.96);

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
