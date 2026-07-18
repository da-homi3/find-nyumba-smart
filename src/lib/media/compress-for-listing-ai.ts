/** Compress listing photos client-side for Gemini multimodal (max 3, small JPEG). */

const AI_IMAGE_MAX_EDGE = 1024;
const AI_JPEG_QUALITY = 0.72;
const MAX_IMAGES = 3;

export type AiImagePayload = {
  mimeType: string;
  base64: string;
};

async function fileToAiJpeg(file: File): Promise<AiImagePayload | null> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return null;
  }
  if (globalThis.document === undefined) return null;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > AI_IMAGE_MAX_EDGE ? AI_IMAGE_MAX_EDGE / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", AI_JPEG_QUALITY);
    });
    if (!blob) return null;

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { mimeType: "image/jpeg", base64: btoa(binary) };
  } catch {
    return null;
  }
}

/** Compress up to 3 image files into base64 JPEG payloads for listing AI. */
export async function compressImagesForListingAi(files: File[]): Promise<AiImagePayload[]> {
  const out: AiImagePayload[] = [];
  for (const file of files.slice(0, MAX_IMAGES)) {
    const payload = await fileToAiJpeg(file);
    if (payload) out.push(payload);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}
