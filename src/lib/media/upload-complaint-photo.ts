import { createSignedMediaUrls } from "@/lib/api/media.functions";
import { enhanceMediaFilesForUpload } from "@/lib/media/enhance-upload";
import { uploadStorageBatchWithProgress } from "@/lib/media/storage-upload";
import { isWithinUploadLimit, uploadLimitLabel } from "@/lib/media/upload-limits";
import { randomUuid } from "@/lib/random-uuid";

const BUCKET = "property-media";
export const MAX_COMPLAINT_PHOTO_MB = 12;

export function assertComplaintPhotoFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name}: not an image`);
  }
  const maxBytes = MAX_COMPLAINT_PHOTO_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`${file.name}: max ${MAX_COMPLAINT_PHOTO_MB}MB`);
  }
  if (!isWithinUploadLimit(file, "image")) {
    throw new Error(`${file.name}: max ${uploadLimitLabel("image")}`);
  }
}

/** Upload one complaint photo under `{userId}/complaints/…`. */
export async function uploadComplaintPhoto(
  userId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  assertComplaintPhotoFile(file);
  const [enhanced] = await enhanceMediaFilesForUpload([file], "image");
  const ext = enhanced.name.split(".").pop() ?? "jpg";
  const path = `${userId}/complaints/${randomUuid()}.${ext}`;

  await uploadStorageBatchWithProgress([{ bucket: BUCKET, path, file: enhanced }], onProgress);

  const signed = await createSignedMediaUrls({
    data: { paths: [path] },
  });
  const url = signed[0]?.signedUrl;
  if (!url) throw new Error("Could not prepare uploaded photo.");
  return url;
}
