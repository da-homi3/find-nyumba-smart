import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { maxUploadBytesForKind } from "@/lib/media/upload-limits";

const CORE_VERSION = "0.12.10";
/** Load from CDN — Workers free/paid asset limit is 25 MiB; core wasm is ~31 MiB. */
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
/** Cap conversion work so phones don’t OOM on huge walkthroughs. */
const MAX_CONVERT_BYTES = 450 * 1024 * 1024;
const CONVERT_TIMEOUT_MS = 4 * 60_000;

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type ConvertProgress = (percent: number) => void;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        globalThis.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function getFfmpeg(onProgress?: ConvertProgress): Promise<FFmpeg> {
  if (!ffmpegSingleton) {
    ffmpegSingleton = new FFmpeg();
  }
  const ffmpeg = ffmpegSingleton;

  ffmpeg.on("progress", ({ progress }) => {
    if (!onProgress) return;
    const pct = Math.max(0, Math.min(99, Math.round((progress || 0) * 100)));
    onProgress(pct);
  });

  if (ffmpeg.loaded) return ffmpeg;

  if (!loadPromise) {
    loadPromise = (async () => {
      const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm");
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }

  return loadPromise;
}

function inputExtension(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".mov")) return "mov";
  if (name.endsWith(".m4v")) return "m4v";
  if (name.endsWith(".avi")) return "avi";
  if (name.endsWith(".wmv")) return "wmv";
  if (name.endsWith(".3gp")) return "3gp";
  if (file.type.includes("quicktime")) return "mov";
  return "mov";
}

/**
 * Convert QuickTime / legacy walkthrough containers to browser-safe H.264 MP4.
 * Primary path: ffmpeg.wasm (CDN). Fallback: MediaRecorder capture when available.
 */
export async function convertVideoToMp4(
  file: File,
  onProgress?: ConvertProgress,
): Promise<File> {
  if (file.size > MAX_CONVERT_BYTES) {
    throw new Error(
      `This video is too large to convert in the browser (${Math.round(file.size / 1024 / 1024)}MB). Use a shorter clip under 450MB, or paste a YouTube/Vimeo link.`,
    );
  }

  try {
    return await convertWithFfmpeg(file, onProgress);
  } catch (ffmpegErr) {
    console.warn("[convert-mov] ffmpeg failed, trying MediaRecorder fallback", ffmpegErr);
    const fallback = await convertWithMediaRecorder(file, onProgress);
    if (fallback) return fallback;
    throw ffmpegErr instanceof Error
      ? ffmpegErr
      : new Error("Could not convert video to MP4");
  }
}

async function convertWithFfmpeg(file: File, onProgress?: ConvertProgress): Promise<File> {
  onProgress?.(1);
  const ffmpeg = await withTimeout(getFfmpeg(onProgress), 90_000, "Loading video converter");

  const inName = `input.${inputExtension(file)}`;
  const outName = "output.mp4";

  try {
    await ffmpeg.writeFile(inName, await fetchFile(file));
    onProgress?.(5);

    // High-quality H.264 + AAC, faststart for progressive playback.
    await withTimeout(
      ffmpeg.exec([
        "-i",
        inName,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        outName,
      ]),
      CONVERT_TIMEOUT_MS,
      "Converting video to MP4",
    );

    const data = await ffmpeg.readFile(outName);
    const bytes =
      data instanceof Uint8Array
        ? data
        : new TextEncoder().encode(String(data));
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: "video/mp4" });
    return finalizeMp4Blob(blob, file, onProgress);
  } finally {
    try {
      await ffmpeg.deleteFile(inName);
    } catch {
      // ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(outName);
    } catch {
      // ignore cleanup errors
    }
  }
}

function finalizeMp4Blob(blob: Blob, source: File, onProgress?: ConvertProgress): File {
  const limit = maxUploadBytesForKind("video");
  if (blob.size < 10_000) {
    throw new Error("Conversion produced an empty video — try a shorter clip or YouTube/Vimeo link.");
  }
  if (blob.size > limit) {
    throw new Error(
      `Converted MP4 is over the ${Math.round(limit / 1024 / 1024)}MB upload limit. Shorten the walkthrough and try again.`,
    );
  }
  onProgress?.(100);
  const base = source.name.replace(/\.[^.]+$/, "") || "walkthrough";
  return new File([blob], `${base}.mp4`, {
    type: "video/mp4",
    lastModified: Date.now(),
  });
}

/** Desktop Chrome/Edge fallback when ffmpeg.wasm cannot load. */
async function convertWithMediaRecorder(
  file: File,
  onProgress?: ConvertProgress,
): Promise<File | null> {
  if (globalThis.document === undefined) return null;
  if (typeof MediaRecorder === "undefined") return null;

  const mimeType = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
  if (!mimeType) return null;

  onProgress?.(5);
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
    12_000,
    "Opening video for conversion",
  ).catch(() => false);

  if (!ready || typeof video.captureStream !== "function") {
    URL.revokeObjectURL(url);
    return null;
  }

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0 || duration > 180) {
    URL.revokeObjectURL(url);
    return null;
  }

  const stream = video.captureStream();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });
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

  const tick = globalThis.setInterval(() => {
    if (!onProgress || !duration) return;
    onProgress(Math.min(95, Math.round((video.currentTime / duration) * 100)));
  }, 400);

  await new Promise<void>((resolve) => {
    video.addEventListener("ended", () => resolve(), { once: true });
    globalThis.setTimeout(
      () => {
        video.pause();
        resolve();
      },
      Math.ceil(duration * 1000) + 800,
    );
  });
  globalThis.clearInterval(tick);
  recorder.stop();
  const blob = await recorded;
  URL.revokeObjectURL(url);

  const ext = mimeType.includes("webm") ? "webm" : "mp4";
  // Prefer mp4 container name even for webm only if type is mp4
  if (ext !== "mp4") {
    // MediaRecorder webm is still web-safe for Chrome/Android; rename accordingly.
    const webmFile = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webm`, {
      type: "video/webm",
      lastModified: Date.now(),
    });
    onProgress?.(100);
    return webmFile;
  }
  return finalizeMp4Blob(blob, file, onProgress);
}
