import { useEffect, useRef, useState } from "react";
import { PLAY_STORE_URL } from "@/components/AppDownloadBanner";
import {
  absoluteInviteHttpsUrl,
  androidAppIntentUrl,
  isAndroidClient,
  isMobileInviteClient,
} from "@/lib/open-in-app";

type Props = Readonly<{
  /** Path beginning with `/`, e.g. `/invite/azizi-realtors`. */
  path: string;
  /** Auto-attempt open once on mobile (default true). */
  autoOpen?: boolean;
}>;

/**
 * On phones, try to hand the invite link to the installed NyumbaSearch app.
 * Desktop visitors see nothing. Android uses an Intent URL; iOS relies on
 * Universal Links (AASA) plus a clear “Open in app” affordance.
 */
export function OpenInviteInApp({ path, autoOpen = true }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    const ua = globalThis.navigator?.userAgent ?? "";
    const mobile = isMobileInviteClient(ua);
    const android = isAndroidClient(ua);
    setIsMobile(mobile);
    setIsAndroid(android);

    if (!mobile || !autoOpen || attempted.current) return;
    attempted.current = true;

    // Already inside the Flutter WebView / custom app — stay on web UI.
    if (
      /NyumbaSearchApp|ke\.co\.nyumbasearch\.app|; wv\)|WebView/i.test(ua) ||
      new URLSearchParams(globalThis.location?.search ?? "").get("app") === "1"
    ) {
      return;
    }

    const httpsUrl = absoluteInviteHttpsUrl(path);
    if (android) {
      globalThis.location.href = androidAppIntentUrl(httpsUrl, PLAY_STORE_URL);
    }
  }, [path, autoOpen]);

  // Hide the banner when already running inside the app WebView.
  const inApp =
    globalThis.navigator !== undefined &&
    (/NyumbaSearchApp|ke\.co\.nyumbasearch\.app|; wv\)|WebView/i.test(
      globalThis.navigator.userAgent,
    ) ||
      new URLSearchParams(globalThis.location?.search ?? "").get("app") === "1");

  if (!isMobile || inApp) return null;

  const httpsUrl = absoluteInviteHttpsUrl(path);
  const openHref = isAndroid ? androidAppIntentUrl(httpsUrl, PLAY_STORE_URL) : httpsUrl;

  return (
    <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">Open in the NyumbaSearch app</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Best experience: continue this invite inside the app.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={openHref}
          className="inline-flex rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background"
        >
          Open app
        </a>
        {isAndroid ? (
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold"
          >
            Get the app
          </a>
        ) : null}
      </div>
    </div>
  );
}
