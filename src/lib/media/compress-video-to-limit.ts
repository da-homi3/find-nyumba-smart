import { VIDEO_UPLOAD_TARGET_BYTES } from "@/lib/media/upload-limits";

export type CompressProgress = (percent: number) => void;

type VideoMeta = {
  duration: number;
  width: number;
  height: number;
};

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

async function readVideoMeta(file: File): Promise<VideoMeta> {
  if (globalThis.document === undefined) {
    throw new Error("Video compression requires a browser");
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("Could not read video")), {
          once: true,
        });
      }),
      15_000,
      "Reading video",
    );
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (duration <= 0) throw new Error("Could not determine video length");
    return { duration, width, height };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

/** Target video bitrate (bits/sec) for a given duration so output ≈ targetBytes. */
function targetVideoBitrate(durationSec: number, targetBytes: number, audioBps = 96_000): number {
  const usableBits = Math.max(0, targetBytes * 8 * 0.92 - audioBps * durationSec);
  const bps = Math.floor(usableBits / Math.max(durationSec, 0.5));
  // Clamp: too low looks broken; too high won't shrink enough.
  return Math.max(250_000, Math.min(bps, 6_000_000));
}

function pickRecorderMime(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: Array<{ mimeType: string; ext: string }> = [
    { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mimeType: "video/mp4", ext: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mimeType: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return null;
}

function scaleToMaxEdge(width: number, height: number, maxEdge: number): { w: number; h: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { w: width || maxEdge, h: height || Math.round(maxEdge * 0.56) };
  }
  const scale = maxEdge / longest;
  return {
    w: Math.max(2, Math.round((width * scale) / 2) * 2),
    h: Math.max(2, Math.round((height * scale) / 2) * 2),
  };
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

function attachOptionalAudio(video: HTMLVideoElement, stream: MediaStream) {
  const videoWithCapture = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
  };
  try {
    if (typeof videoWithCapture.captureStream !== "function") return;
    const vs = videoWithCapture.captureStream();
    for (const track of vs.getAudioTracks()) {
      stream.addTrack(track);
    }
  } catch {
    /* audio optional */
  }
}

async function waitForVideoCanPlay(video: HTMLVideoElement): Promise<boolean> {
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.addEventListener("canplay", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("Video failed to open")), {
          once: true,
        });
      }),
      20_000,
      "Opening video for compression",
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForPlaybackEnd(video: HTMLVideoElement, durationSec: number): Promise<void> {
  await new Promise<void>((resolve) => {
    video.addEventListener("ended", () => resolve(), { once: true });
    globalThis.setTimeout(
      () => {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
        resolve();
      },
      Math.ceil(durationSec * 1000) + 1500,
    );
  });
}

function fileFromBlob(blob: Blob, sourceName: string, ext: string, mimeType: string): File {
  const base = sourceName.replace(/\.[^.]+$/, "") || "walkthrough";
  return new File([blob], `${base}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

/**
 * Re-encode by playing the video into a canvas and capturing with MediaRecorder.
 * Works on many mobile browsers (canvas.captureStream) without loading ffmpeg.wasm.
 */
async function compressWithCanvasRecorder(
  file: File,
  meta: VideoMeta,
  targetBytes: number,
  maxEdge: number,
  bitrateScale: number,
  onProgress?: CompressProgress,
): Promise<File | null> {
  const mime = pickRecorderMime();
  if (!mime || typeof document === "undefined") return null;

  const { w, h } = scaleToMaxEdge(meta.width, meta.height, maxEdge);
  const videoBitsPerSecond = Math.floor(
    targetVideoBitrate(meta.duration, targetBytes) * bitrateScale,
  );

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    URL.revokeObjectURL(url);
    return null;
  }

  if (!(await waitForVideoCanPlay(video))) {
    URL.revokeObjectURL(url);
    return null;
  }

  const fps = meta.duration > 90 ? 12 : 18;
  if (typeof canvas.captureStream !== "function") {
    URL.revokeObjectURL(url);
    return null;
  }
  const stream = canvas.captureStream(fps);
  attachOptionalAudio(video, stream);

  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mime.mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: 96_000,
    });
  } catch {
    URL.revokeObjectURL(url);
    stopTracks(stream);
    return null;
  }

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Compression recorder failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.mimeType.split(";")[0] }));
  });

  let raf = 0;
  let stopped = false;
  const draw = () => {
    if (stopped) return;
    ctx.drawImage(video, 0, 0, w, h);
    if (onProgress && meta.duration > 0) {
      onProgress(Math.min(95, Math.round((video.currentTime / meta.duration) * 100)));
    }
    raf = requestAnimationFrame(draw);
  };

  recorder.start(250);
  draw();
  try {
    await video.play();
  } catch {
    stopped = true;
    cancelAnimationFrame(raf);
    if (recorder.state !== "inactive") recorder.stop();
    URL.revokeObjectURL(url);
    stopTracks(stream);
    return null;
  }

  await waitForPlaybackEnd(video, meta.duration);
  stopped = true;
  cancelAnimationFrame(raf);
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await recorded;
  URL.revokeObjectURL(url);
  stopTracks(stream);

  if (blob.size < 8_000) return null;
  onProgress?.(100);
  return fileFromBlob(blob, file.name, mime.ext, mime.ext === "mp4" ? "video/mp4" : "video/webm");
}

/** Desktop fallback: ffmpeg.wasm ultrafast encode sized to the limit. */
async function compressWithFfmpeg(
  file: File,
  meta: VideoMeta,
  targetBytes: number,
  maxEdge: number,
  bitrateScale: number,
  onProgress?: CompressProgress,
): Promise<File | null> {
  // Skip loading ~31MB wasm for tiny overruns that canvas should handle.
  if (file.size > 400 * 1024 * 1024) return null;

  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      onProgress?.(Math.min(99, Math.round((progress || 0) * 100)));
    });

    const CORE_VERSION = "0.12.10";
    const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
    const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm");
    await withTimeout(ffmpeg.load({ coreURL, wasmURL }), 60_000, "Loading compressor");

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const inName = `in.${ext}`;
    const outName = "out.mp4";
    await ffmpeg.writeFile(inName, await fetchFile(file));

    const { w } = scaleToMaxEdge(meta.width, meta.height, maxEdge);
    const videoBps = Math.floor(targetVideoBitrate(meta.duration, targetBytes) * bitrateScale);
    const videoKbps = Math.max(250, Math.floor(videoBps / 1000));

    await withTimeout(
      ffmpeg.exec([
        "-i",
        inName,
        "-vf",
        `scale=${w}:-2`,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-b:v",
        `${videoKbps}k`,
        "-maxrate",
        `${videoKbps}k`,
        "-bufsize",
        `${videoKbps * 2}k`,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        "-y",
        outName,
      ]),
      Math.min(180_000, Math.max(60_000, Math.ceil(meta.duration * 2500))),
      "Compressing video",
    );

    const data = await ffmpeg.readFile(outName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: "video/mp4" });
    if (blob.size < 8_000) return null;
    const base = file.name.replace(/\.[^.]+$/, "") || "walkthrough";
    onProgress?.(100);
    return new File([blob], `${base}.mp4`, { type: "video/mp4", lastModified: Date.now() });
  } catch (err) {
    console.warn("[compress-video] ffmpeg path failed", err);
    return null;
  }
}

/**
 * Shrink a walkthrough so it fits under the storage hard cap.
 * Tries canvas+MediaRecorder first (phones), then ffmpeg on desktop.
 */
export async function compressVideoToFitLimit(
  file: File,
  maxBytes: number = VIDEO_UPLOAD_TARGET_BYTES,
  onProgress?: CompressProgress,
): Promise<File> {
  if (file.size <= maxBytes) {
    onProgress?.(100);
    return file;
  }

  onProgress?.(1);
  const meta = await readVideoMeta(file);

  // Long walkthroughs need aggressive downscale to stay under the Free-plan 50MB cap.
  const attempts: Array<{ maxEdge: number; bitrateScale: number }> = [
    { maxEdge: 1280, bitrateScale: 1 },
    { maxEdge: 960, bitrateScale: 0.75 },
    { maxEdge: 720, bitrateScale: 0.55 },
    { maxEdge: 540, bitrateScale: 0.4 },
  ];

  let last: File | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]!;
    onProgress?.(Math.round((i / attempts.length) * 5) + 1);

    let result =
      (await compressWithCanvasRecorder(
        file,
        meta,
        maxBytes,
        attempt.maxEdge,
        attempt.bitrateScale,
        (p) => onProgress?.(Math.min(99, Math.round(5 + p * 0.9))),
      )) ?? null;

    result ??= await compressWithFfmpeg(
      file,
      meta,
      maxBytes,
      attempt.maxEdge,
      attempt.bitrateScale,
      (p) => onProgress?.(Math.min(99, Math.round(5 + p * 0.9))),
    );

    if (result) {
      last = result;
      if (result.size <= maxBytes) {
        onProgress?.(100);
        return result;
      }
    }
  }

  if (last && last.size < file.size) {
    // Best effort — still over limit.
    throw new Error(
      `Couldn’t shrink this video under ${Math.round(maxBytes / 1024 / 1024)}MB (got ${Math.round(last.size / 1024 / 1024)}MB). Use a shorter clip or a YouTube/Vimeo link.`,
    );
  }

  throw new Error(
    `This video is too large (${Math.round(file.size / 1024 / 1024)}MB). Try a shorter clip or paste a YouTube/Vimeo link.`,
  );
}
