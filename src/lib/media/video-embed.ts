/** External walkthrough hosts that need an iframe, not <video src>. */
export function isExternalVideoEmbed(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
    } else if (u.pathname.startsWith("/embed/")) {
      id = u.pathname.slice("/embed/".length).split("/")[0] ?? "";
    } else if (u.pathname.startsWith("/shorts/")) {
      id = u.pathname.slice("/shorts/".length).split("/")[0] ?? "";
    } else {
      id = u.searchParams.get("v") ?? "";
    }
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&hd=1`;
  } catch {
    return null;
  }
}

export function vimeoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const match = /\/(?:video\/)?(\d+)/.exec(u.pathname);
    if (!match?.[1]) return null;
    return `https://player.vimeo.com/video/${match[1]}`;
  } catch {
    return null;
  }
}

export function externalVideoEmbedUrl(url: string): string | null {
  if (/youtube\.com|youtu\.be/i.test(url)) return youtubeEmbedUrl(url);
  if (/vimeo\.com/i.test(url)) return vimeoEmbedUrl(url);
  return null;
}

/** Guess a MIME type from a storage/path URL for <source type>. */
export function videoMimeFromUrl(url: string): string | undefined {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".mp4") || path.endsWith(".m4v")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".ogg") || path.endsWith(".ogv")) return "video/ogg";
  if (path.endsWith(".mov")) return "video/quicktime";
  return undefined;
}

/** Formats that HTML5 <video> often cannot play on Chrome/Android. */
export function isLikelyUnsupportedHtml5Video(url: string): boolean {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  return path.endsWith(".mov") || path.endsWith(".avi") || path.endsWith(".wmv");
}
