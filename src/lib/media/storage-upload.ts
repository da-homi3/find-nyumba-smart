import { supabase } from "@/integrations/supabase/client";

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getSupabaseStorageBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw new Error("Supabase URL is not configured");
  return url.replace(/\/$/, "");
}

function getSupabaseAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!key) throw new Error("Supabase publishable key is not configured");
  return key;
}

export type StorageUploadProgress = (percent: number) => void;

/** Upload a single object with byte-level progress via XHR (Supabase Storage REST API). */
export async function uploadStorageObjectWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress?: StorageUploadProgress,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required");

  const base = getSupabaseStorageBaseUrl();
  const encodedPath = encodeStoragePath(path);
  const url = `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = body.message ?? body.error ?? message;
      } catch {
        if (xhr.responseText) message = xhr.responseText;
      }
      reject(new Error(message));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed — network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", url);
    xhr.setRequestHeader("apikey", getSupabaseAnonKey());
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(file);
  });
}

/** Upload via a Supabase signed upload URL (admin on-behalf listing media). */
export async function uploadStorageObjectViaSignedUrl(
  signedUrl: string,
  token: string,
  file: File,
  onProgress?: StorageUploadProgress,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = body.message ?? body.error ?? message;
      } catch {
        if (xhr.responseText) message = xhr.responseText;
      }
      reject(new Error(message));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed — network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(file);
  });
}

export async function uploadStorageBatchWithProgress(
  items: ReadonlyArray<{ bucket: string; path: string; file: File }>,
  onProgress?: StorageUploadProgress,
): Promise<void> {
  if (items.length === 0) return;

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0) || 1;
  let completedBytes = 0;

  for (const item of items) {
    await uploadStorageObjectWithProgress(item.bucket, item.path, item.file, (filePercent) => {
      if (!onProgress) return;
      const currentLoaded = (filePercent / 100) * item.file.size;
      const overall = Math.min(
        100,
        Math.round(((completedBytes + currentLoaded) / totalBytes) * 100),
      );
      onProgress(overall);
    });
    completedBytes += item.file.size;
    onProgress?.(Math.min(100, Math.round((completedBytes / totalBytes) * 100)));
  }
}
