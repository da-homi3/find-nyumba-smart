import { toast } from "sonner";

export type ListingUploadPhase =
  | "idle"
  | "enhancing"
  | "uploading"
  | "publishing"
  | "done"
  | "error";

export type ListingUploadSnapshot = {
  phase: ListingUploadPhase;
  progress: number | null;
  error: string | null;
  propertyKey: string | null;
};

type Listener = (snapshot: ListingUploadSnapshot) => void;

type ActiveRun = {
  propertyKey: string;
  phase: ListingUploadPhase;
  progress: number | null;
  error: string | null;
  completedPaths: Set<string>;
  pathByFileId: Map<string, string>;
  promise: Promise<unknown>;
  listeners: Set<Listener>;
  wakeLock: WakeLockSentinel | null;
};

let activeRun: ActiveRun | null = null;

function snapshotFrom(run: ActiveRun | null): ListingUploadSnapshot {
  if (!run) {
    return { phase: "idle", progress: null, error: null, propertyKey: null };
  }
  return {
    phase: run.phase,
    progress: run.progress,
    error: run.error,
    propertyKey: run.propertyKey,
  };
}

function notify(run: ActiveRun) {
  const snap = snapshotFrom(run);
  for (const listener of run.listeners) listener(snap);
}

export function getListingUploadSnapshot(): ListingUploadSnapshot {
  return snapshotFrom(activeRun);
}

export function isListingUploadBusy(): boolean {
  const phase = activeRun?.phase;
  return phase === "enhancing" || phase === "uploading" || phase === "publishing";
}

export function subscribeListingUpload(listener: Listener): () => void {
  if (!activeRun) {
    listener(snapshotFrom(null));
    return () => undefined;
  }
  activeRun.listeners.add(listener);
  listener(snapshotFrom(activeRun));
  return () => {
    activeRun?.listeners.delete(listener);
  };
}

export function fileUploadIdentity(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}::${file.type}`;
}

async function requestWakeLock(run: ActiveRun): Promise<void> {
  try {
    if (!("wakeLock" in navigator)) return;
    run.wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    // Wake Lock is best-effort (denied / unsupported / hidden tab).
  }
}

async function releaseWakeLock(run: ActiveRun): Promise<void> {
  try {
    await run.wakeLock?.release();
  } catch {
    // ignore
  }
  run.wakeLock = null;
}

export type DurableUploadPlanItem = {
  id: string;
  path: string;
  file: File;
  role: "image" | "video" | "tour";
};

export type DurableUploadController = {
  propertyKey: string;
  completedPaths: Set<string>;
  pathByFileId: Map<string, string>;
  setPhase: (phase: ListingUploadPhase) => void;
  setProgress: (progress: number | null) => void;
  markPathDone: (path: string) => void;
  resolvePath: (fileId: string, buildPath: () => string) => string;
};

/**
 * Runs a listing publish inside a module-level session so React remounts
 * (tab UI remount, admin mode toggle, etc.) reconnect instead of restarting.
 */
export async function runDurableListingUpload<T>(
  propertyKey: string,
  work: (controller: DurableUploadController) => Promise<T>,
): Promise<T> {
  if (activeRun && isListingUploadBusy()) {
    return activeRun.promise as Promise<T>;
  }

  const run: ActiveRun = {
    propertyKey,
    phase: "enhancing",
    progress: 0,
    error: null,
    completedPaths: activeRun?.propertyKey === propertyKey ? activeRun.completedPaths : new Set(),
    pathByFileId:
      activeRun?.propertyKey === propertyKey ? activeRun.pathByFileId : new Map<string, string>(),
    promise: Promise.resolve(),
    listeners: new Set(),
    wakeLock: null,
  };

  const controller: DurableUploadController = {
    propertyKey,
    completedPaths: run.completedPaths,
    pathByFileId: run.pathByFileId,
    setPhase: (phase) => {
      run.phase = phase;
      if (phase === "uploading" && run.progress == null) run.progress = 0;
      if (phase === "publishing") run.progress = null;
      notify(run);
    },
    setProgress: (progress) => {
      run.progress = progress;
      notify(run);
    },
    markPathDone: (path) => {
      run.completedPaths.add(path);
    },
    resolvePath: (fileId, buildPath) => {
      const existing = run.pathByFileId.get(fileId);
      if (existing) return existing;
      const path = buildPath();
      run.pathByFileId.set(fileId, path);
      return path;
    },
  };

  const promise = (async () => {
    await requestWakeLock(run);
    try {
      const result = await work(controller);
      run.phase = "done";
      run.progress = null;
      run.error = null;
      notify(run);
      return result;
    } catch (err) {
      run.phase = "error";
      run.error = err instanceof Error ? err.message : String(err);
      notify(run);
      throw err;
    } finally {
      await releaseWakeLock(run);
      // Keep completed path map briefly so an immediate retry can resume.
      window.setTimeout(() => {
        if (activeRun === run && (run.phase === "done" || run.phase === "error")) {
          activeRun = null;
        }
      }, 30_000);
    }
  })();

  run.promise = promise;
  activeRun = run;
  notify(run);
  return promise;
}

/** Warn when the tab is backgrounded mid-upload; never aborts the transfer. */
export function attachUploadVisibilityGuard(): () => void {
  const onVisibility = () => {
    if (!isListingUploadBusy()) return;
    if (document.visibilityState === "hidden") {
      toast.message("Upload still running", {
        id: "listing-upload-keep-open",
        description: "Keep this tab open until publishing finishes.",
        duration: 6000,
      });
      return;
    }
    // Re-request wake lock when returning to the tab.
    if (activeRun) void requestWakeLock(activeRun);
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}
