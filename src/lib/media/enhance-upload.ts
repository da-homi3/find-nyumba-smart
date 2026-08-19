import {
  maxUploadBytesForKind,
  VIDEO_UPLOAD_TARGET_BYTES,
  type MediaUploadKind,
} from "@/lib/media/upload-limits";
import { mapPool, preferredEnhanceConcurrency } from "@/lib/media/storage-upload";

/**
 * Longest edge after downscale. Cards load via Supabase Image Transformation;
 * originals stay sharper for the detail gallery (around 1000px CSS / 2x).
 */
const MAX_IMAGE_EDGE_PX = 2560;
/**
 * Skip decode/re-encode for compact JPEG/WebP — the CPU cost of re-encoding often
 * exceeds the upload-time savings on mid-range phones. Oversized dimensions still
 * get downscaled when the file is larger than this.
 */
const SKIP_REENCODE_UNDER_BYTES = Math.floor(1.8 * 1024 * 1024);
const JPEG_QUALITY = 0.8;
const WEBP_QUALITY = 0.78;

function outputMimeForImage(file: File): string {
  if (file.type === "image/webp") return "image/webp";
  // Prefer JPEG over PNG for photos (PNG balloons upload size).
  return "image/jpeg";
}

function fileNameWithExt(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  if (mime === "image/webp") return `${base}.webp`;
  return `${base}.jpg`;
}

function canvasExportQuality(mime: string): number {
  if (mime === "image/webp") return WEBP_QUALITY;
  return JPEG_QUALITY;
}

async function bitmapToFile(bitmap: ImageBitmap, mime: string, name: string): Promise<File> {
  const quality = canvasExportQuality(mime);
  const width = bitmap.width;
  const height = bitmap.height;

  // OffscreenCanvas encodes without touching the DOM — faster and avoids layout thrash.
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const blob = await canvas.convertToBlob({ type: mime, quality });
        return new File([blob], fileNameWithExt(name, mime), {
          type: mime,
          lastModified: Date.now(),
        });
      }
    } catch {
      // Fall through to HTMLCanvasElement.
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, quality);
  });
  if (!blob) throw new Error("Could not process image");
  return new File([blob], fileNameWithExt(name, mime), { type: mime, lastModified: Date.now() });
}

function isAlreadyWebReady(file: File): boolean {
  return (
    (file.type === "image/jpeg" || file.type === "image/webp") &&
    file.size > 0 &&
    file.size <= SKIP_REENCODE_UNDER_BYTES
  );
}

/**
 * Decode and optionally downscale in one pass. Prefer createImageBitmap's native
 * resize — it's much faster than decoding full-res then canvas-scaling.
 */
async function loadSizedBitmap(file: File): Promise<{ bitmap: ImageBitmap; downscaled: boolean }> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_IMAGE_EDGE_PX) {
    return { bitmap, downscaled: false };
  }

  const scale = MAX_IMAGE_EDGE_PX / longest;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  try {
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "medium",
    });
    bitmap.close();
    return { bitmap: resized, downscaled: true };
  } catch {
    // Older engines: keep full bitmap; caller draws into a smaller canvas.
    return { bitmap, downscaled: false };
  }
}

function pickSmaller(original: File, enhanced: File, forcedChange: boolean): File {
  const limit = maxUploadBytesForKind("image");
  if (enhanced.size > limit) return original;
  if (!forcedChange && enhanced.size >= original.size * 0.95 && original.type === enhanced.type) {
    return original;
  }
  return enhanced;
}

/** Downscale oversized photos and compress before upload. Skips heavy work when already small. */
export async function enhanceImageForUpload(file: File): Promise<File> {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }

  if (globalThis.document === undefined) return file;

  // Fast path: phone-compressed JPEGs under the skip threshold need no CPU work.
  if (isAlreadyWebReady(file)) return file;

  try {
    const { bitmap, downscaled } = await loadSizedBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const stillOversized = longest > MAX_IMAGE_EDGE_PX;
    const needsReencode =
      file.type === "image/png" ||
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.size > SKIP_REENCODE_UNDER_BYTES ||
      downscaled ||
      stillOversized;

    if (!needsReencode) {
      bitmap.close();
      return file;
    }

    if (stillOversized) {
      const scale = MAX_IMAGE_EDGE_PX / longest;
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!ctx) {
        bitmap.close();
        return file;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const mime = outputMimeForImage(file);
      const enhanced = await new Promise<File>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not process image"));
              return;
            }
            resolve(
              new File([blob], fileNameWithExt(file.name, mime), {
                type: mime,
                lastModified: Date.now(),
              }),
            );
          },
          mime,
          canvasExportQuality(mime),
        );
      });
      return pickSmaller(file, enhanced, true);
    }

    const mime = outputMimeForImage(file);
    const enhanced = await bitmapToFile(bitmap, mime, file.name);
    bitmap.close();
    return pickSmaller(file, enhanced, downscaled);
  } catch {
    return file;
  }
}

export function isLikelyVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mov|mp4|webm|m4v|avi|wmv|3gp)$/i.test(file.name);
}

/**
 * True when the container is not already a common web MP4/WebM.
 * Used for UI hints only — we no longer block upload on conversion.
 */
export function needsWebSafeVideoReencode(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (
    type === "video/mp4" ||
    type === "video/webm" ||
    name.endsWith(".mp4") ||
    name.endsWith(".webm")
  ) {
    return false;
  }
  if (
    name.endsWith(".mov") ||
    name.endsWith(".avi") ||
    name.endsWith(".wmv") ||
    name.endsWith(".m4v")
  ) {
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
  return type.startsWith("video/") || isLikelyVideoFile(file);
}

export type EnhanceVideoOptions = {
  onProgress?: (percent: number) => void;
};

/**
 * Prepare walkthrough for upload: shrink oversized clips to the storage hard cap,
 * then optionally remux MOV→MP4 on desktop.
 */
export async function enhanceVideoForUpload(
  file: File,
  options?: EnhanceVideoOptions,
): Promise<File> {
  if (!isLikelyVideoFile(file)) return file;

  let next = ensureVideoMime(file);

  if (next.size > VIDEO_UPLOAD_TARGET_BYTES) {
    const { compressVideoToFitLimit } = await import("@/lib/media/compress-video-to-limit");
    next = await compressVideoToFitLimit(next, VIDEO_UPLOAD_TARGET_BYTES, options?.onProgress);
  }

  // Remux to MP4 on capable desktops only (never block phones with wasm).
  if (needsWebSafeVideoReencode(next) && !isMobileLikeClient()) {
    try {
      const { convertVideoToMp4 } = await import("@/lib/media/convert-mov-to-mp4");
      next = await convertVideoToMp4(next, options?.onProgress);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message !== "SKIP_BROWSER_CONVERT" && !message.includes("timed out")) {
        console.warn("[enhance-video] remux skipped", err);
      }
    }
  }

  options?.onProgress?.(100);
  return ensureVideoMime(next);
}

function isMobileLikeClient(): boolean {
  if (globalThis.window === undefined) return true;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/\bNyumbaSearchApp\b/i.test(ua)) return true;
  try {
    if (globalThis.matchMedia?.("(pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function ensureVideoMime(file: File): File {
  const name = file.name.toLowerCase();
  if (file.type && file.type !== "application/octet-stream") return file;
  if (name.endsWith(".mov") || name.endsWith(".qt")) {
    return new File([file], file.name, {
      type: "video/quicktime",
      lastModified: file.lastModified,
    });
  }
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) {
    return new File([file], file.name, { type: "video/mp4", lastModified: file.lastModified });
  }
  if (name.endsWith(".webm")) {
    return new File([file], file.name, { type: "video/webm", lastModified: file.lastModified });
  }
  return file;
}

export async function enhanceMediaFilesForUpload(
  files: File[],
  kind: MediaUploadKind,
  options?: EnhanceVideoOptions,
): Promise<File[]> {
  if (kind === "video") {
    const out: File[] = [];
    for (const file of files) {
      out.push(await enhanceVideoForUpload(file, options));
    }
    return out;
  }
  // Cap image enhance concurrency so phones don't OOM decoding 15 full-res bitmaps at once.
  const out = new Array<File>(files.length);
  await mapPool(files, preferredEnhanceConcurrency(), async (file, index) => {
    out[index] = await enhanceImageForUpload(file);
  });
  return out;
}
