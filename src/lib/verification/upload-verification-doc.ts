import { createSignedVerificationUrls } from "@/lib/api/trust.functions";
import { uploadStorageBatchWithProgress } from "@/lib/media/storage-upload";
import {
  type VerificationType,
  VERIFICATION_DOCUMENT_CONFIG,
  verificationStoragePath,
} from "@/lib/verification/document-config";

const BUCKET = "verification-documents";

export async function uploadVerificationDocuments(
  userId: string,
  verificationType: VerificationType,
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<string[]> {
  const config = VERIFICATION_DOCUMENT_CONFIG[verificationType];
  if (!config.requiresUpload) return [];

  if (files.length === 0) {
    throw new Error(`Please upload at least one ${config.uploadLabel.toLowerCase()}.`);
  }
  if (files.length > config.maxFiles) {
    throw new Error(`You can upload up to ${config.maxFiles} file(s) for this level.`);
  }

  const maxBytes = config.maxMb * 1024 * 1024;
  const paths: string[] = [];

  for (const file of files) {
    if (file.size > maxBytes) {
      throw new Error(`${file.name} exceeds ${config.maxMb}MB.`);
    }
    paths.push(verificationStoragePath(userId, verificationType, file.name));
  }

  const uploads = files.map((file, index) => ({
    bucket: BUCKET,
    path: paths[index]!,
    file,
  }));

  await uploadStorageBatchWithProgress(uploads, onProgress);

  const signed = await createSignedVerificationUrls({ data: { paths } });
  const urls = signed.map((row) => row.signedUrl).filter((url): url is string => Boolean(url));

  if (urls.length !== paths.length) {
    throw new Error("Could not prepare uploaded documents for review.");
  }

  return urls;
}
