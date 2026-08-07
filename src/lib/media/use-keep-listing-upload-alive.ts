import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  attachUploadVisibilityGuard,
  getListingUploadSnapshot,
  isListingUploadBusy,
  subscribeListingUpload,
  type ListingUploadSnapshot,
} from "@/lib/media/listing-upload-session";

const LEAVE_MESSAGE = "Your listing is still uploading. Leave this page and cancel the upload?";

function setAndroidPullToRefresh(enabled: boolean) {
  try {
    window.NyumbaAndroid?.setPullToRefreshEnabled?.(enabled);
  } catch {
    /* bridge optional outside the Play Store shell */
  }
}

/**
 * Keeps listing uploads alive across tab focus changes and blocks navigation
 * while publish is in progress. Subscribe to reconnect UI after remounts.
 */
export function useKeepListingUploadAlive(
  onSnapshot?: (snapshot: ListingUploadSnapshot) => void,
): ListingUploadSnapshot {
  useEffect(() => {
    const unsubscribe = subscribeListingUpload((snapshot) => {
      const busy =
        snapshot.phase === "enhancing" ||
        snapshot.phase === "uploading" ||
        snapshot.phase === "publishing";
      setAndroidPullToRefresh(!busy);
      onSnapshot?.(snapshot);
    });
    const detachVisibility = attachUploadVisibilityGuard();
    if (isListingUploadBusy()) setAndroidPullToRefresh(false);
    return () => {
      unsubscribe();
      detachVisibility();
      // Remount mid-upload must not re-enable Android pull-to-refresh.
      if (!isListingUploadBusy()) setAndroidPullToRefresh(true);
    };
  }, [onSnapshot]);

  useBlocker({
    shouldBlockFn: () => {
      if (!isListingUploadBusy()) return false;
      return !globalThis.confirm(LEAVE_MESSAGE);
    },
    enableBeforeUnload: () => isListingUploadBusy(),
    disabled: false,
  });

  return getListingUploadSnapshot();
}
