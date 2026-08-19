/**
 * Client-side upload caps for property media.
 *
 * Picker allows large walkthroughs; oversized files are compressed to
 * VIDEO_UPLOAD_TARGET_BYTES before upload (Pro Storage allows 900MB objects).
 */
export const MAX_IMAGE_UPLOAD_MB = 500;
/** Max size the file picker accepts (before auto-compress). */
export const MAX_VIDEO_UPLOAD_MB = 900;
/**
 * Size we actually upload to Storage. Matches the property-media bucket
 * file_size_limit (900MB on Pro).
 */
export const VIDEO_STORAGE_HARD_CAP_MB = 900;
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
