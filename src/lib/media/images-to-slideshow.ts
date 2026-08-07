/**
 * Build a slow slideshow walkthrough MP4/WebM from listing photos
 * using canvas + MediaRecorder (same approach as video compression).
 */

export type SlideshowProgress = (percent: number) => void;

export type SlideshowOptions = {
  /** Hold time per photo in seconds (slow walkthrough). */
  secondsPerSlide?: number;
  /** Crossfade duration between photos. */
  fadeSeconds?: number;
  /** Output canvas width. */
  width?: number;
  /** Output canvas height. */
  height?: number;
  fps?: number;
  /** Target bitrate for MediaRecorder (higher = sharper). */
  videoBitsPerSecond?: number;
  onProgress?: SlideshowProgress;
};

/** Default “good enough” settings. */
const DEFAULTS = {
  secondsPerSlide: 3.5,
  fadeSeconds: 0.7,
  width: 1280,
  height: 720,
  fps: 15,
  videoBitsPerSecond: 2_500_000,
} as const;

/** Full-HD auto walkthrough — use for listing publish / manage-media. */
export const HIGH_QUALITY_SLIDESHOW: Required<
  Pick<
    SlideshowOptions,
    "secondsPerSlide" | "fadeSeconds" | "width" | "height" | "fps" | "videoBitsPerSecond"
  >
> = {
  secondsPerSlide: 4,
  fadeSeconds: 0.8,
  width: 1920,
  height: 1080,
  fps: 30,
  videoBitsPerSecond: 10_000_000,
};

function pickRecorderMime(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: Array<{ mimeType: string; ext: string }> = [
    // Prefer higher H.264 profiles when the browser supports them.
    { mimeType: "video/mp4;codecs=avc1.640028,mp4a.40.2", ext: "mp4" },
    { mimeType: "video/mp4;codecs=avc1.4D401F,mp4a.40.2", ext: "mp4" },
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

async function loadBitmap(source: File | Blob | ImageBitmap): Promise<ImageBitmap> {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return source;
  }
  return createImageBitmap(source as Blob);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  canvasW: number,
  canvasH: number,
  zoom = 1,
) {
  const bw = bitmap.width;
  const bh = bitmap.height;
  const scale = Math.max(canvasW / bw, canvasH / bh) * zoom;
  const dw = bw * scale;
  const dh = bh * scale;
  const dx = (canvasW - dw) / 2;
  const dy = (canvasH - dh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, dx, dy, dw, dh);
}

/**
 * Create a slow ken-burns slideshow from listing photos.
 * Requires at least one image. Returns a video File ready for upload.
 */
export async function createSlideshowWalkthrough(
  images: Array<File | Blob>,
  options?: SlideshowOptions,
): Promise<File> {
  if (typeof document === "undefined") {
    throw new TypeError("Slideshow generation requires a browser");
  }
  if (!images.length) {
    throw new Error("Add at least one photo to generate a walkthrough");
  }

  const mime = pickRecorderMime();
  if (!mime) {
    throw new Error("This browser cannot record slideshow video — upload a walkthrough instead");
  }

  const secondsPerSlide = options?.secondsPerSlide ?? DEFAULTS.secondsPerSlide;
  const fadeSeconds = Math.min(options?.fadeSeconds ?? DEFAULTS.fadeSeconds, secondsPerSlide * 0.4);
  const width = options?.width ?? DEFAULTS.width;
  const height = options?.height ?? DEFAULTS.height;
  const fps = options?.fps ?? DEFAULTS.fps;
  const videoBitsPerSecond = options?.videoBitsPerSecond ?? DEFAULTS.videoBitsPerSecond;
  const onProgress = options?.onProgress;

  const bitmaps: ImageBitmap[] = [];
  try {
    for (let i = 0; i < images.length; i++) {
      bitmaps.push(await loadBitmap(images[i]!));
      onProgress?.(Math.round(((i + 1) / images.length) * 8));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Could not create slideshow canvas");
    if (typeof canvas.captureStream !== "function") {
      throw new TypeError(
        "This browser cannot record slideshow video — upload a walkthrough instead",
      );
    }

    const stream = canvas.captureStream(fps);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: mime.mimeType,
      videoBitsPerSecond,
    });

    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Slideshow recorder failed"));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime.mimeType.split(";")[0] }));
    });

    const frameMs = 1000 / fps;
    const holdFrames = Math.max(1, Math.round(secondsPerSlide * fps));
    const fadeFrames = Math.max(0, Math.round(fadeSeconds * fps));
    const totalFrames = bitmaps.length * holdFrames;
    let frameIndex = 0;

    recorder.start(100);

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        try {
          if (frameIndex >= totalFrames) {
            resolve();
            return;
          }

          const slideIndex = Math.floor(frameIndex / holdFrames);
          const frameInSlide = frameIndex % holdFrames;
          const current = bitmaps[slideIndex]!;
          const next = bitmaps[(slideIndex + 1) % bitmaps.length]!;

          // Slow zoom: 1.0 → 1.06 over the slide (subtle for sharper stills)
          const zoomT = frameInSlide / Math.max(1, holdFrames - 1);
          const zoom = 1 + zoomT * 0.06;

          ctx.fillStyle = "#0b1220";
          ctx.fillRect(0, 0, width, height);
          drawCover(ctx, current, width, height, zoom);

          // Crossfade into next slide near the end (except last slide)
          if (slideIndex < bitmaps.length - 1 && frameInSlide >= holdFrames - fadeFrames) {
            const fadeT =
              fadeFrames === 0 ? 1 : (frameInSlide - (holdFrames - fadeFrames)) / fadeFrames;
            ctx.save();
            ctx.globalAlpha = Math.min(1, Math.max(0, fadeT));
            drawCover(ctx, next, width, height, 1);
            ctx.restore();
          }

          frameIndex += 1;
          onProgress?.(Math.min(99, Math.round(8 + (frameIndex / totalFrames) * 90)));
          globalThis.setTimeout(tick, frameMs);
        } catch (err) {
          reject(err);
        }
      };
      tick();
    });

    if (recorder.state !== "inactive") recorder.stop();
    const blob = await recorded;
    for (const track of stream.getTracks()) track.stop();

    if (blob.size < 8_000) {
      throw new Error("Slideshow video was empty — try again or upload a walkthrough");
    }

    onProgress?.(100);
    return new File([blob], `photo-walkthrough.${mime.ext}`, {
      type: mime.ext === "mp4" ? "video/mp4" : "video/webm",
      lastModified: Date.now(),
    });
  } finally {
    for (const b of bitmaps) {
      try {
        b.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/** Fetch listing image URLs into Blobs for slideshow generation. */
export async function fetchImagesForSlideshow(urls: string[]): Promise<Blob[]> {
  const out: Blob[] = [];
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const blob = await res.blob();
    if (blob.type.startsWith("image/") || blob.size > 0) out.push(blob);
  }
  return out;
}
