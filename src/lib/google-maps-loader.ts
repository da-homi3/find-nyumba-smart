/// <reference types="google.maps" />

const LOADER_TIMEOUT_MS = 8000;
const CALLBACK_NAME = "__nyumbaInitMap";

export type GoogleMapsWindow = Window &
  typeof globalThis & {
    google?: typeof google;
    gm_authFailure?: () => void;
    [key: string]: unknown;
  };

export function getGoogleMapsWindow(): GoogleMapsWindow {
  return globalThis as GoogleMapsWindow;
}

export type LoadGoogleMapsOptions = {
  apiKey: string;
  trackingId?: string;
  libraries?: string;
  timeoutMs?: number;
};

let loaderPromise: Promise<typeof google> | null = null;

function getDocument(): Document | undefined {
  return globalThis.document;
}

/** Load Google Maps JS API once with timeout and auth-failure handling. */
export function loadGoogleMaps(opts: LoadGoogleMapsOptions): Promise<typeof google> {
  if (globalThis.window === undefined) return Promise.reject(new Error("SSR"));
  const mapsWindow = getGoogleMapsWindow();
  if (mapsWindow.google?.maps) return Promise.resolve(mapsWindow.google);
  if (loaderPromise) return loaderPromise;

  const timeoutMs = opts.timeoutMs ?? LOADER_TIMEOUT_MS;

  loaderPromise = new Promise((resolve, reject) => {
    const previousAuthFailure = mapsWindow.gm_authFailure;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      fn();
    };

    mapsWindow.gm_authFailure = () => {
      previousAuthFailure?.();
      finish(() => {
        loaderPromise = null;
        reject(
          new Error(
            "Google Maps key is not authorized for this domain. Check API key restrictions and billing.",
          ),
        );
      });
    };

    mapsWindow[CALLBACK_NAME] = () => {
      finish(() => {
        if (mapsWindow.google) resolve(mapsWindow.google);
        else {
          loaderPromise = null;
          reject(new Error("Google Maps failed to initialize"));
        }
      });
    };

    const timer = globalThis.setTimeout(() => {
      finish(() => {
        loaderPromise = null;
        reject(new Error("Network is too slow to load the map. Showing offline view."));
      });
    }, timeoutMs);

    const params = new URLSearchParams({
      key: opts.apiKey,
      libraries: opts.libraries ?? "marker",
      loading: "async",
      callback: CALLBACK_NAME,
      ...(opts.trackingId ? { channel: opts.trackingId } : {}),
    });

    const doc = getDocument();
    if (!doc) {
      loaderPromise = null;
      reject(new Error("Document not available"));
      return;
    }

    const existing = doc.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );
    if (existing) {
      existing.remove();
    }

    const script = doc.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () =>
      finish(() => {
        loaderPromise = null;
        reject(new Error("Failed to load Google Maps. Check your connection and API key."));
      });
    doc.head.appendChild(script);
  });

  return loaderPromise;
}

export function resetGoogleMapsLoader() {
  loaderPromise = null;
}
