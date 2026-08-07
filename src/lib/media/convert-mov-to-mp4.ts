import { maxUploadBytesForKind } from "@/lib/media/upload-limits";

const CORE_VERSION = "0.12.10";
/** Load from CDN — Workers free/paid asset limit is 25 MiB; core wasm is ~31 MiB. */
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
/**
 * Remux only (stream copy). Full H.264 re-encode in wasm routinely exceeds minutes on phones
 * and timed out at 240s for users — never do that in the browser.
 */
const MAX_REMUX_BYTES = 350 * 1024 * 1024;
const LOAD_TIMEOUT_MS = 45_000;
const REMUX_TIMEOUT_MS = 60_000;

let ffmpegSingleton: import("@ffmpeg/ffmpeg").FFmpeg | null = null;
let loadPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

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

/** Phones / Safari: ffmpeg.wasm is too slow — callers should upload the original. */
export function shouldSkipBrowserVideoConvert(): boolean {
  if (globalThis.window === undefined) return true;
  const ua = navigator.userAgent || "";
  // iPhone / iPad / iPod — source of most .MOV walkthroughs; wasm convert hangs/times out.
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // Android WebView / mobile Chrome — same problem for large clips.
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/\bNyumbaSearchApp\b/i.test(ua)) return true;
  // Coarse pointer ≈ phone/tablet.
  try {
    if (globalThis.matchMedia?.("(pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function getFfmpeg(onProgress?: ConvertProgress): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  ffmpegSingleton ??= new FFmpeg();
  const ffmpeg = ffmpegSingleton;

  ffmpeg.on("progress", ({ progress }) => {
    if (!onProgress) return;
    const pct = Math.max(0, Math.min(99, Math.round((progress || 0) * 100)));
    onProgress(pct);
  });

  if (ffmpeg.loaded) return ffmpeg;

  loadPromise ??= (async () => {
    const { toBlobURL } = await import("@ffmpeg/util");
    const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm");
    await ffmpeg.load({ coreURL, wasmURL });
    return ffmpeg;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

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
 * Prefer a fast remux to MP4 (no re-encode). On mobile — or if remux fails —
 * callers should upload the original file instead of waiting on a full encode.
 */
export async function convertVideoToMp4(file: File, onProgress?: ConvertProgress): Promise<File> {
  if (shouldSkipBrowserVideoConvert()) {
    throw new Error("SKIP_BROWSER_CONVERT");
  }
  if (file.size > MAX_REMUX_BYTES) {
    throw new Error("SKIP_BROWSER_CONVERT");
  }

  try {
    return await remuxWithFfmpeg(file, onProgress);
  } catch (err) {
    if (err instanceof Error && err.message === "SKIP_BROWSER_CONVERT") throw err;
    console.warn("[convert-mov] remux failed; upload original instead", err);
    throw new Error("SKIP_BROWSER_CONVERT");
  }
}

async function remuxWithFfmpeg(file: File, onProgress?: ConvertProgress): Promise<File> {
  onProgress?.(1);
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await withTimeout(
    getFfmpeg(onProgress),
    LOAD_TIMEOUT_MS,
    "Loading video converter",
  );

  const inName = `input.${inputExtension(file)}`;
  const outName = "output.mp4";

  try {
    await ffmpeg.writeFile(inName, await fetchFile(file));
    onProgress?.(8);

    // Stream copy only — seconds, not minutes. No libx264 in the browser.
    await withTimeout(
      ffmpeg.exec(["-i", inName, "-c", "copy", "-movflags", "+faststart", outName]),
      REMUX_TIMEOUT_MS,
      "Preparing video for upload",
    );

    const data = await ffmpeg.readFile(outName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
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
    throw new Error("SKIP_BROWSER_CONVERT");
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
