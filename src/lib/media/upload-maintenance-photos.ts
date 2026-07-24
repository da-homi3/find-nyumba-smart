import { createSignedMediaUrls } from "@/lib/api/media.functions";
import { enhanceMediaFilesForUpload } from "@/lib/media/enhance-upload";
import { uploadStorageBatchWithProgress } from "@/lib/media/storage-upload";
import { isWithinUploadLimit, uploadLimitLabel } from "@/lib/media/upload-limits";
import { randomUuid } from "@/lib/random-uuid";

const BUCKET = "property-media";
export const MAX_MAINTENANCE_PHOTOS = 5;
/** Cap each maintenance photo well under listing limits — phone snaps, not walkthroughs. */
export const MAX_MAINTENANCE_PHOTO_MB = 12;

export function assertMaintenancePhotoFiles(files: File[]): File[] {
  const maxBytes = MAX_MAINTENANCE_PHOTO_MB * 1024 * 1024;
  return files.filter((file) => {
    if (!file.type.startsWith("image/")) {
      throw new Error(`${file.name}: not an image`);
    }
    if (file.size > maxBytes) {
      throw new Error(`${file.name}: max ${MAX_MAINTENANCE_PHOTO_MB}MB`);
    }
    if (!isWithinUploadLimit(file, "image")) {
      throw new Error(`${file.name}: max ${uploadLimitLabel("image")}`);
    }
    return true;
  });
}

/** Upload maintenance photos under `{userId}/maintenance/…` and return long-lived signed URLs. */
export async function uploadMaintenancePhotos(
  userId: string,
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<string[]> {
  if (!files.length) return [];
  if (files.length > MAX_MAINTENANCE_PHOTOS) {
    throw new Error(`You can attach up to ${MAX_MAINTENANCE_PHOTOS} photos.`);
  }

  assertMaintenancePhotoFiles(files);
  const enhanced = await enhanceMediaFilesForUpload(files, "image");
  const uploads = enhanced.map((file) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/maintenance/${randomUuid()}.${ext}`;
    return { bucket: BUCKET, path, file };
  });

  await uploadStorageBatchWithProgress(uploads, onProgress);

  const signed = await createSignedMediaUrls({
    data: { paths: uploads.map((item) => item.path) },
  });

  const urls = signed.map((row) => row.signedUrl).filter((url): url is string => Boolean(url));
  if (urls.length !== uploads.length) {
    throw new Error("Could not prepare uploaded photos.");
  }
  return urls;
}
