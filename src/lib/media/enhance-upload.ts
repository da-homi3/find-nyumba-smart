import { maxUploadBytesForKind, type MediaUploadKind } from "@/lib/media/upload-limits";

const MAX_IMAGE_EDGE_PX = 3840;
const JPEG_QUALITY = 0.93;
const PNG_QUALITY = 0.95;

/** Bound metadata / canplay waits so mobile Safari never hangs the upload UI. */
const VIDEO_META_TIMEOUT_MS = 8_000;
const VIDEO_CANPLAY_TIMEOUT_MS = 10_000;
/** Client re-encode is realtime playback — only attempt short clips. */
const MAX_CLIENT_REENCODE_DURATION_SEC = 90;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      () => {
        globalThis.clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

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

type VideoMeta = {
  durationSec: number;
  width: number;
  height: number;
};

function isLikelyVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mov|mp4|webm|m4v|avi|wmv|3gp)$/i.test(file.name);
}

function readVideoMeta(file: File): Promise<VideoMeta | null> {
  if (globalThis.document === undefined) return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
        resolve({
          durationSec,
          width: video.videoWidth,
          height: video.videoHeight,
        });
        cleanup();
      },
      { once: true },
    );

    video.addEventListener(
      "error",
      () => {
        resolve(null);
        cleanup();
      },
      { once: true },
    );

    video.src = url;
  });
}

function preferredVideoMimeType(): string {
  // Prefer MP4 for widest HTML5 playback (Chrome + Safari + Android).
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/mp4")) {
    return "video/mp4";
  }
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    return "video/webm;codecs=vp9";
  }
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm")) {
    return "video/webm";
  }
  return "";
}

/** Whether this browser can convert MOV → MP4/WebM in-page (most iPhones cannot). */
export function canClientReencodeVideo(): boolean {
  if (globalThis.document === undefined) return false;
  if (typeof MediaRecorder === "undefined") return false;
  if (!preferredVideoMimeType()) return false;
  const probe = document.createElement("video") as HTMLVideoElement & {
    captureStream?: () => MediaStream;
  };
  return typeof probe.captureStream === "function";
}

/** True when the container/codec often fails in Chrome/Android <video>. */
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
  // Already web-safe containers
  if (type === "video/mp4" || type === "video/webm" || name.endsWith(".mp4") || name.endsWith(".webm")) {
    return false;
  }
  // Unknown video types — try to normalize
  return type.startsWith("video/") || isLikelyVideoFile(file);
}

type ReencodeOptions = {
  /** When true, accept smaller outputs (format conversion). */
  forCompatibility?: boolean;
  maxDurationSec?: number;
};

async function reencodeVideoAtHighBitrate(
  file: File,
  meta: VideoMeta,
  options: ReencodeOptions = {},
): Promise<File | null> {
  if (globalThis.document === undefined) return null;
  if (!canClientReencodeVideo()) return null;
  const maxDuration = options.maxDurationSec ?? MAX_CLIENT_REENCODE_DURATION_SEC;
  if (meta.durationSec <= 0 || meta.durationSec > maxDuration) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video") as HTMLVideoElement & {
    captureStream?: () => MediaStream;
  };
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  const ready = await withTimeout(
    new Promise<boolean>((resolve) => {
      video.addEventListener("canplay", () => resolve(true), { once: true });
      video.addEventListener("error", () => resolve(false), { once: true });
    }),
    VIDEO_CANPLAY_TIMEOUT_MS,
    false,
  );
  if (!ready) {
    URL.revokeObjectURL(url);
    return null;
  }

  const stream = video.captureStream?.();
  if (!stream) {
    URL.revokeObjectURL(url);
    return null;
  }

  const mimeType = preferredVideoMimeType();
  if (!mimeType) {
    URL.revokeObjectURL(url);
    return null;
  }

  const targetBitrate = Math.min(
    8_000_000,
    Math.max(2_500_000, Math.round((meta.width * meta.height) / 1_200)),
  );

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: targetBitrate });

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("recorder failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
  });

  recorder.start(250);
  try {
    await video.play();
  } catch {
    recorder.stop();
    URL.revokeObjectURL(url);
    return null;
  }

  await new Promise<void>((resolve) => {
    video.addEventListener("ended", () => resolve(), { once: true });
    globalThis.setTimeout(
      () => {
        video.pause();
        resolve();
      },
      Math.ceil(meta.durationSec * 1000) + 500,
    );
  });

  recorder.stop();
  const blob = await recorded;
  URL.revokeObjectURL(url);

  const ext = mimeType.includes("webm") ? "webm" : "mp4";
  const enhanced = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), {
    type: blob.type || (ext === "webm" ? "video/webm" : "video/mp4"),
    lastModified: Date.now(),
  });

  const limit = maxUploadBytesForKind("video");
  if (enhanced.size > limit || enhanced.size < 10_000) return null;
  // Quality-boost path: reject drastic size drops that usually mean a bad encode.
  if (!options.forCompatibility && enhanced.size < file.size * 0.5) return null;
  return enhanced;
}

/**
 * Prepare walkthrough videos for upload.
 * MP4/WebM upload as-is (fast). MOV only converts when the browser can —
 * never hangs waiting on Safari metadata / canplay.
 */
export async function enhanceVideoForUpload(file: File): Promise<File> {
  if (!isLikelyVideoFile(file)) return file;

  // Already web-safe — skip expensive client re-encode (was the main 0% stall).
  if (!needsWebSafeVideoReencode(file)) return file;

  // iOS Safari / Android WebView usually lack captureStream — fail open immediately.
  if (!canClientReencodeVideo()) return file;

  const meta = await withTimeout(readVideoMeta(file), VIDEO_META_TIMEOUT_MS, null);
  if (!meta || meta.durationSec <= 0) return file;
  if (meta.durationSec > MAX_CLIENT_REENCODE_DURATION_SEC) return file;

  const encodeBudgetMs = Math.min(
    75_000,
    Math.ceil(meta.durationSec * 1000) + 12_000,
  );

  try {
    const reencoded = await withTimeout(
      reencodeVideoAtHighBitrate(file, meta, {
        forCompatibility: true,
        maxDurationSec: MAX_CLIENT_REENCODE_DURATION_SEC,
      }),
      encodeBudgetMs,
      null,
    );
    return reencoded ?? file;
  } catch {
    return file;
  }
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

export { isLikelyVideoFile };
