import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isStandaloneDisplay } from "@/lib/register-pwa";

const DISMISS_KEY = "nyumba-install-banner-dismissed";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=ke.co.nyumbasearch.app";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Shown only in a normal mobile browser tab (where Chrome shows the URL bar).
 * Standalone PWA + Android WebView already have no browser chrome.
 */
export function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const narrow = window.matchMedia("(max-width: 768px)").matches;
    if (!narrow) return;

    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      setDeferred(null);
      return;
    }
    window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <dialog
      open
      aria-label="Install NyumbaSearch"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-70 m-0 w-full max-w-none border-0 bg-transparent p-0 px-3 pb-2 open:flex open:justify-center sm:bottom-4"
    >
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-border/60 bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Open without the browser bar</p>
          <p className="text-xs text-muted-foreground">
            Install NyumbaSearch — no address bar at the top.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Download className="size-3.5" aria-hidden />
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </dialog>
  );
}
