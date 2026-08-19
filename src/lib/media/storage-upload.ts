import { supabase } from "@/integrations/supabase/client";

/** Parallel XHRs — raised on good networks via preferredUploadConcurrency(). */
export const STORAGE_UPLOAD_CONCURRENCY = 4;

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

function readNetworkInfo(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { connection?: NetworkInformationLike };
  return nav.connection ?? null;
}

function isCoarsePointerClient(): boolean {
  if (typeof globalThis.matchMedia !== "function") return false;
  try {
    return globalThis.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/** Upload XHR pool size — phones share a small per-host connection pool with the page. */
export function preferredUploadConcurrency(): number {
  const conn = readNetworkInfo();
  if (conn?.saveData) return 2;
  const et = conn?.effectiveType;
  if (et === "slow-2g" || et === "2g" || et === "3g") return 2;
  if (isCoarsePointerClient()) return 2;
  return 4;
}

/** Auto walkthrough encoding is too heavy to run beside photo uploads on phones. */
export function shouldAutoGenerateListingSlideshow(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isCoarsePointerClient()) return false;
  const conn = readNetworkInfo();
  if (conn?.saveData) return false;
  const et = conn?.effectiveType;
  if (et === "slow-2g" || et === "2g" || et === "3g") return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && memory > 0 && memory < 4) return false;
  return true;
}

/** Image decode/re-encode pool — keep phones from OOM'ing on full-res bitmaps. */
export function preferredEnhanceConcurrency(): number {
  const conn = readNetworkInfo();
  if (conn?.saveData || isCoarsePointerClient()) return 2;
  const et = conn?.effectiveType;
  if (et === "slow-2g" || et === "2g" || et === "3g") return 2;
  return 4;
}

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

type UploadOptions = {
  upsert?: boolean;
  /** Reuse a session token across a batch (avoids N getSession round-trips). */
  accessToken?: string;
};

function reportXhrProgress(
  event: ProgressEvent<EventTarget>,
  fileSize: number,
  onProgress?: StorageUploadProgress,
) {
  if (!onProgress) return;
  if (event.lengthComputable && event.total > 0) {
    onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    return;
  }
  // Safari / some mobile browsers omit lengthComputable — estimate from file size.
  if (fileSize > 0 && event.loaded > 0) {
    onProgress(Math.min(99, Math.round((event.loaded / fileSize) * 100)));
  }
}

const MAX_UPLOAD_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function uploadTimeoutMs(fileSize: number): number {
  const mb = Math.max(1, Math.ceil(fileSize / (1024 * 1024)));
  return Math.min(8 * 60_000, Math.max(90_000, mb * 8_000 + 45_000));
}

function xhrFailureMessage(kind: "error" | "timeout"): string {
  if (kind === "timeout") return "Upload timed out";
  const online = typeof navigator === "undefined" || navigator.onLine;
  return online ? "Upload was interrupted" : "Upload failed — you appear to be offline";
}

export function isRetryableUploadFailure(message: string, status?: number): boolean {
  if (status === 401 || status === 408 || status === 429) return true;
  if (status != null && status >= 500) return true;
  return /interrupted|timed out|network error|offline|failed to fetch|fetch failed/i.test(message);
}

function parseUploadErrorMessage(status: number, responseText: string): string {
  let message = `Upload failed (${status})`;
  try {
    const body = JSON.parse(responseText) as { message?: string; error?: string };
    message = body.message ?? body.error ?? message;
  } catch {
    if (responseText) message = responseText;
  }
  if (/maximum allowed size|entity too large|payload too large/i.test(message)) {
    return "This video is still too large after compression. Try a shorter clip or paste a YouTube/Vimeo link.";
  }
  return message;
}

function parseStatusFromMessage(message: string): number | undefined {
  const match = /\((\d{3})\)/.exec(message);
  if (!match) return undefined;
  return Number(match[1]);
}

export async function resolveAccessToken(explicit?: string, refresh = false): Promise<string> {
  if (explicit && !refresh) return explicit;
  if (refresh) {
    const { data } = await supabase.auth.refreshSession();
    const token = data.session?.access_token;
    if (token) return token;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required");
  return token;
}

type XhrUploadRequest = {
  method: "POST" | "PUT";
  url: string;
  file: File;
  headers: Record<string, string>;
  onProgress?: StorageUploadProgress;
};

function sendXhrUpload(request: XhrUploadRequest): Promise<void> {
  const { method, url, file, headers, onProgress } = request;
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = uploadTimeoutMs(file.size);
    xhr.upload.addEventListener("progress", (event) => {
      reportXhrProgress(event, file.size, onProgress);
    });
    xhr.upload.addEventListener("loadstart", () => {
      onProgress?.(1);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(parseUploadErrorMessage(xhr.status, xhr.responseText)));
    });
    xhr.addEventListener("error", () => reject(new Error(xhrFailureMessage("error"))));
    xhr.addEventListener("timeout", () => reject(new Error(xhrFailureMessage("timeout"))));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open(method, url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(file);
  });
}

async function withUploadRetries(work: (attempt: number) => Promise<void>): Promise<void> {
  let lastError: Error = new Error("Upload failed");
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    try {
      await work(attempt);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message === "Upload cancelled") throw lastError;
      const status = parseStatusFromMessage(lastError.message);
      const retry = attempt < MAX_UPLOAD_ATTEMPTS && isRetryableUploadFailure(lastError.message, status);
      if (!retry) throw lastError;
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}

async function uploadViaSupabaseClient(
  bucket: string,
  path: string,
  file: File,
  upsert: boolean,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(error.message);
}

/** Run async work over items with a fixed concurrency pool. */
export async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const poolSize = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: poolSize }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        await worker(items[index]!, index);
      }
    }),
  );
}

/**
 * Upload many files with overall byte progress, running several XHRs in parallel.
 * `alreadyCompleted` items count toward progress but are not re-uploaded.
 */
export async function uploadItemsWithConcurrency<T extends { file: File }>(
  allItems: readonly T[],
  pending: readonly T[],
  uploadOne: (item: T, onFileProgress?: StorageUploadProgress) => Promise<void>,
  onProgress?: StorageUploadProgress,
  concurrency: number = preferredUploadConcurrency(),
): Promise<void> {
  const totalBytes = allItems.reduce((sum, item) => sum + item.file.size, 0) || 1;
  const pendingSet = new Set(pending);
  const alreadyDoneBytes = allItems
    .filter((item) => !pendingSet.has(item))
    .reduce((sum, item) => sum + item.file.size, 0);

  if (pending.length === 0) {
    onProgress?.(100);
    return;
  }

  const loadedByPending = new Array(pending.length).fill(0);
  const report = () => {
    if (!onProgress) return;
    const inFlight = loadedByPending.reduce((sum, n) => sum + n, 0);
    onProgress(Math.min(99, Math.round(((alreadyDoneBytes + inFlight) / totalBytes) * 100)));
  };

  if (alreadyDoneBytes > 0) report();

  await mapPool(pending, concurrency, async (item, index) => {
    await uploadOne(item, (filePercent) => {
      loadedByPending[index] = (filePercent / 100) * item.file.size;
      report();
    });
    loadedByPending[index] = item.file.size;
    report();
  });

  onProgress?.(100);
}

/**
 * Enhance each file then upload immediately — overlaps CPU work with network so the
 * first photos start transferring while later ones are still being compressed.
 */
export async function enhanceAndUploadWithProgress<T>(
  files: readonly File[],
  enhanceOne: (file: File) => Promise<File>,
  buildItem: (enhanced: File, index: number) => T & { bucket: string; path: string; file: File },
  onProgress?: StorageUploadProgress,
  concurrency: number = preferredUploadConcurrency(),
): Promise<Array<T & { bucket: string; path: string; file: File }>> {
  if (files.length === 0) return [];

  const accessToken = await resolveAccessToken();
  const results = new Array<T & { bucket: string; path: string; file: File }>(files.length);
  // Weight: enhance ≈ 20% of each file's share, upload ≈ 80%.
  const weights = files.map((f) => Math.max(f.size, 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const doneEnhance = new Array(files.length).fill(0);
  const doneUpload = new Array(files.length).fill(0);

  const report = () => {
    if (!onProgress) return;
    let loaded = 0;
    for (let i = 0; i < files.length; i++) {
      loaded += weights[i]! * (0.2 * doneEnhance[i]! + 0.8 * doneUpload[i]!);
    }
    onProgress(Math.min(99, Math.round((loaded / totalWeight) * 100)));
  };

  await mapPool(files, concurrency, async (file, index) => {
    const enhanced = await enhanceOne(file);
    doneEnhance[index] = 1;
    report();

    const item = buildItem(enhanced, index);
    results[index] = item;
    await uploadStorageObjectWithProgress(
      item.bucket,
      item.path,
      item.file,
      (filePercent) => {
        doneUpload[index] = filePercent / 100;
        report();
      },
      { accessToken },
    );
    doneUpload[index] = 1;
    report();
  });

  onProgress?.(100);
  return results;
}

/** Upload a single object with byte-level progress via XHR (Supabase Storage REST API). */
export async function uploadStorageObjectWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress?: StorageUploadProgress,
  options?: UploadOptions,
): Promise<void> {
  const base = getSupabaseStorageBaseUrl();
  const encodedPath = encodeStoragePath(path);
  const url = `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
  let token = await resolveAccessToken(options?.accessToken);

  try {
    await withUploadRetries(async (attempt) => {
      if (attempt > 1) {
        token = await resolveAccessToken(undefined, true);
      }
      await sendXhrUpload({
        method: "POST",
        url,
        file,
        headers: {
          apikey: getSupabaseAnonKey(),
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": options?.upsert ? "true" : "false",
        },
        onProgress,
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isRetryableUploadFailure(message, parseStatusFromMessage(message))) throw err;
    await uploadViaSupabaseClient(bucket, path, file, true);
    onProgress?.(100);
  }
}

/** Upload via a Supabase signed upload URL (admin on-behalf listing media). */
export async function uploadStorageObjectViaSignedUrl(
  signedUrl: string,
  token: string,
  file: File,
  onProgress?: StorageUploadProgress,
  options?: UploadOptions,
): Promise<void> {
  await withUploadRetries(async () => {
    await sendXhrUpload({
      method: "PUT",
      url: signedUrl,
      file,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": options?.upsert ? "true" : "false",
      },
      onProgress,
    });
  });
}

export async function uploadStorageBatchWithProgress(
  items: ReadonlyArray<{ bucket: string; path: string; file: File }>,
  onProgress?: StorageUploadProgress,
): Promise<void> {
  if (items.length === 0) return;

  const accessToken = await resolveAccessToken();
  await uploadItemsWithConcurrency(
    items,
    items,
    (item, onFileProgress) =>
      uploadStorageObjectWithProgress(item.bucket, item.path, item.file, onFileProgress, {
        accessToken,
      }),
    onProgress,
  );
}
