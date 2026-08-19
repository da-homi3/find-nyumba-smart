import { describe, expect, it } from "vitest";
import { isRetryableUploadFailure } from "@/lib/media/storage-upload";

describe("isRetryableUploadFailure", () => {
  it("retries interrupted and timeout errors", () => {
    expect(isRetryableUploadFailure("Upload was interrupted")).toBe(true);
    expect(isRetryableUploadFailure("Upload timed out")).toBe(true);
    expect(isRetryableUploadFailure("Upload failed — network error")).toBe(true);
  });

  it("retries transient HTTP statuses", () => {
    expect(isRetryableUploadFailure("Upload failed (503)", 503)).toBe(true);
    expect(isRetryableUploadFailure("Upload failed (429)", 429)).toBe(true);
    expect(isRetryableUploadFailure("Upload failed (401)", 401)).toBe(true);
  });

  it("does not retry validation failures", () => {
    expect(isRetryableUploadFailure("Upload failed (400)", 400)).toBe(false);
    expect(isRetryableUploadFailure("The resource already exists", 409)).toBe(false);
    expect(isRetryableUploadFailure("Upload cancelled")).toBe(false);
  });
});
