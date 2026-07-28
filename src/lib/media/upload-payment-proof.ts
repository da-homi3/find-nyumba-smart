import { createSignedMediaUrls } from "@/lib/api/media.functions";
import { uploadStorageBatchWithProgress } from "@/lib/media/storage-upload";
import { isWithinUploadLimit, uploadLimitLabel } from "@/lib/media/upload-limits";
import { randomUuid } from "@/lib/random-uuid";

const BUCKET = "property-media";
export const MAX_PAYMENT_PROOF_FILES = 1;
export const MAX_PAYMENT_PROOF_MB = 12;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function assertPaymentProofFile(file: File): File {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`${file.name}: use an image or PDF`);
  }
  const maxBytes = MAX_PAYMENT_PROOF_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`${file.name}: max ${MAX_PAYMENT_PROOF_MB}MB`);
  }
  if (file.type.startsWith("image/") && !isWithinUploadLimit(file, "image")) {
    throw new Error(`${file.name}: max ${uploadLimitLabel("image")}`);
  }
  return file;
}

/** Upload payment proof under `{userId}/payment-proofs/…` and return a signed URL. */
export async function uploadPaymentProof(
  userId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  assertPaymentProofFile(file);
  const ext = file.name.split(".").pop() ?? (file.type === "application/pdf" ? "pdf" : "jpg");
  const path = `${userId}/payment-proofs/${randomUuid()}.${ext}`;

  await uploadStorageBatchWithProgress([{ bucket: BUCKET, path, file }], onProgress);

  const signed = await createSignedMediaUrls({
    data: { paths: [path] },
  });
  const url = signed[0]?.signedUrl;
  if (!url) throw new Error("Could not prepare uploaded proof.");
  return url;
}
