import { maxUploadBytesForKind, type MediaUploadKind } from "@/lib/media/upload-limits";

const MAX_IMAGE_EDGE_PX = 3840;
const JPEG_QUALITY = 0.93;
const PNG_QUALITY = 0.95;

function sharpenImageData(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const copy = new Uint8ClampedArray(data);
  const w = width;
  const h = height;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[i + c]!;
        const neighbors =
          copy[i - w * 4 + c]! + copy[i + w * 4 + c]! + copy[i - 4 + c]! + copy[i + 4 + c]!;
        const sharpened = center * 5 - neighbors;
        data[i + c] = Math.min(255, Math.max(0, Math.round(center * 0.85 + sharpened * 0.15)));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function outputMimeForImage(file: File): string {
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

function fileNameWithExt(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  if (mime === "image/png") return `${base}.png`;
  if (mime === "image/webp") return `${base}.webp`;
  return `${base}.jpg`;
}

function canvasExportQuality(mime: string): number {
  if (mime === "image/jpeg") return JPEG_QUALITY;
  if (mime === "image/webp") return 0.92;
  return PNG_QUALITY;
}

async function canvasToFile(canvas: HTMLCanvasElement, mime: string, name: string): Promise<File> {
  const quality = canvasExportQuality(mime);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, quality);
  });
  if (!blob) throw new Error("Could not process image");
  return new File([blob], fileNameWithExt(name, mime), { type: mime, lastModified: Date.now() });
}

/** Sharpen and re-encode listing photos at high quality before upload. */
export async function enhanceImageForUpload(file: File): Promise<File> {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }

  if (globalThis.document === undefined) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_IMAGE_EDGE_PX ? MAX_IMAGE_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    sharpenImageData(ctx, width, height);

    const mime = outputMimeForImage(file);
    const enhanced = await canvasToFile(canvas, mime, file.name);
    const limit = maxUploadBytesForKind("image");
    return enhanced.size <= limit ? enhanced : file;
  } catch {
    return file;
  }
}

export function isLikelyVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mov|mp4|webm|m4v|avi|wmv|3gp)$/i.test(file.name);
}

/**
 * True when the container/codec often fails in Chrome/Android <video>.
 * Landlords should export MP4/WebM instead — we never lossy-re-encode
 * (MediaRecorder would destroy phone camera quality).
 */
export function needsWebSafeVideoReencode(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (name.endsWith(".mov") || name.endsWith(".avi") || name.endsWith(".wmv") || name.endsWith(".m4v")) {
    return true;
  }
  if (
    type.includes("quicktime") ||
    type === "video/avi" ||
    type === "video/x-msvideo" ||
    type === "video/x-ms-wmv" ||
    type === "video/3gpp"
  ) {
    return true;
  }
  if (type === "video/mp4" || type === "video/webm" || name.endsWith(".mp4") || name.endsWith(".webm")) {
    return false;
  }
  return type.startsWith("video/") || isLikelyVideoFile(file);
}

/**
 * Preserve original walkthrough bytes at full camera quality.
 * No client re-encode — that path was lossy and slow.
 */
export async function enhanceVideoForUpload(file: File): Promise<File> {
  return file;
}

export async function enhanceMediaFilesForUpload(
  files: File[],
  kind: MediaUploadKind,
): Promise<File[]> {
  if (kind === "video") {
    return Promise.all(files.map((file) => enhanceVideoForUpload(file)));
  }
  return Promise.all(files.map((file) => enhanceImageForUpload(file)));
}
