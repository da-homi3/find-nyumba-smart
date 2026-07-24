/** Register the installable PWA service worker (standalone = no browser URL bar). */
export function registerPwaServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  // Android Play WebView must not use the PWA SW — it can trap fetches and hang listings.
  if (isAndroidNativeShell()) return;

  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* Install still works via Add to Home Screen on many Android browsers. */
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

function isAndroidNativeShell(): boolean {
  return (
    window.NyumbaAndroid !== undefined ||
    document.documentElement.classList.contains("nyumba-android-app") ||
    /NyumbaSearchApp|NyumbaAndroid/i.test(navigator.userAgent)
  );
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || iosStandalone || isAndroidNativeShell();
}

declare global {
  interface Window {
    NyumbaAndroid?: { getPlatform?: () => string };
  }
}
