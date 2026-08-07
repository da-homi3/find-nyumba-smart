import { videoMimeFromUrl } from "@/lib/media/video-embed";

export type SaveMediaResult = "gallery" | "share" | "download";

function guessMime(filename: string, url: string, fallback?: string): string {
  if (fallback?.includes("/")) return fallback;
  const fromUrl = videoMimeFromUrl(url);
  if (fromUrl) return fromUrl;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v") || lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return fallback ?? "application/octet-stream";
}

function triggerAnchorDownload(objectUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Save media to the device gallery when possible:
 * - Android app → native MediaStore (Photos / Movies)
 * - iPhone Safari → share sheet (Save Video / Save Image)
 * - Desktop → standard file download
 */
export async function saveMediaToGallery(input: {
  url: string;
  filename: string;
  mimeType?: string;
}): Promise<SaveMediaResult> {
  const mime = guessMime(input.filename, input.url, input.mimeType);
  const bridge = typeof window !== "undefined" ? window.NyumbaAndroid : undefined;

  if (typeof bridge?.saveMediaToGallery === "function") {
    bridge.saveMediaToGallery(input.url, mime, input.filename);
    return "gallery";
  }

  const res = await fetch(input.url);
  if (!res.ok) throw new Error(`Could not download ${input.filename}`);
  const blob = await res.blob();
  const type = mime.includes("/") ? mime : blob.type || mime;
  const file = new File([blob], input.filename, { type });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === "function" && typeof nav.canShare === "function") {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: input.filename,
          text: "Save to Photos / gallery",
        });
        return "share";
      }
    } catch (err) {
      // User dismissed the share sheet — not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return "share";
      // Fall through to download for unsupported share payloads.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    triggerAnchorDownload(objectUrl, input.filename);
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
  }
  return "download";
}

export function saveResultToast(result: SaveMediaResult, label = "Walkthrough"): string {
  if (result === "gallery") return `${label} saved to your gallery`;
  if (result === "share") return `${label} ready — choose Save Video / Save Image`;
  return `${label} download started`;
}
