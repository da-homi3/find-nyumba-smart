import { describe, expect, it } from "vitest";
import {
  externalVideoEmbedUrl,
  isExternalVideoEmbed,
  isLikelyUnsupportedHtml5Video,
  videoMimeFromUrl,
  youtubeEmbedUrl,
} from "@/lib/media/video-embed";

describe("video-embed", () => {
  it("detects YouTube and Vimeo links", () => {
    expect(isExternalVideoEmbed("https://youtu.be/abc123")).toBe(true);
    expect(isExternalVideoEmbed("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isExternalVideoEmbed("https://vimeo.com/123456")).toBe(true);
    expect(isExternalVideoEmbed("https://cdn.example.com/walk.mp4")).toBe(false);
  });

  it("builds YouTube embed URLs", () => {
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1&hd=1",
    );
    // playsinline keeps mobile Safari from hijacking into fullscreen.
    expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toContain("playsinline=1");
    expect(youtubeEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toContain(
      "/embed/dQw4w9WgXcQ",
    );
    expect(youtubeEmbedUrl("https://example.com/not-a-video")).toBeNull();
    expect(externalVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toContain("/embed/dQw4w9WgXcQ");
  });

  it("guesses mime types from storage URLs", () => {
    expect(videoMimeFromUrl("https://x/object/sign/property-media/a/video-1.mp4?token=t")).toBe(
      "video/mp4",
    );
    expect(videoMimeFromUrl("https://x/a/video.mov?token=t")).toBe("video/quicktime");
    expect(isLikelyUnsupportedHtml5Video("https://x/a/video.mov")).toBe(true);
    expect(isLikelyUnsupportedHtml5Video("https://x/a/video.mp4")).toBe(false);
  });
});
