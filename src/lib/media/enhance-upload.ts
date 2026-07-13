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

type VideoMeta = {
  durationSec: number;
  width: number;
  height: number;
};

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
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    return "video/webm;codecs=vp9";
  }
  if (MediaRecorder.isTypeSupported("video/webm")) {
    return "video/webm";
  }
  return "";
}

async function reencodeVideoAtHighBitrate(file: File, meta: VideoMeta): Promise<File | null> {
  if (globalThis.document === undefined) return null;
  if (meta.durationSec <= 0 || meta.durationSec > 180) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("canplay", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("video load failed")), { once: true });
  });

  const stream = (
    video as HTMLVideoElement & { captureStream?: () => MediaStream }
  ).captureStream?.();
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
    12_000_000,
    Math.max(4_000_000, Math.round((meta.width * meta.height) / 1_000)),
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
  await video.play();

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
    type: blob.type,
    lastModified: Date.now(),
  });

  const limit = maxUploadBytesForKind("video");
  if (enhanced.size > limit || enhanced.size < file.size * 0.5) return null;
  return enhanced;
}

/**
 * Boost walkthrough videos when they are heavily compressed; otherwise keep the original file.
 */
export async function enhanceVideoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("video/")) return file;

  const meta = await readVideoMeta(file);
  if (!meta || meta.durationSec <= 0) return file;

  const estimatedBitrate = (file.size * 8) / meta.durationSec;
  const looksCompressed = estimatedBitrate < 2_500_000 || meta.width < 960;

  if (!looksCompressed) return file;

  try {
    const reencoded = await reencodeVideoAtHighBitrate(file, meta);
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
