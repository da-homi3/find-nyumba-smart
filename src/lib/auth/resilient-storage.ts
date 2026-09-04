/**
 * Supabase auth storage that writes to both localStorage and sessionStorage.
 * Mobile in-app browsers (WhatsApp, Instagram) often block or partition localStorage;
 * sessionStorage fallback keeps the session alive for the current tab.
 */
export function createResilientAuthStorage(): Storage {
  const primary = safeStorage(() => localStorage);
  const fallback = safeStorage(() => sessionStorage);

  return {
    get length() {
      return Math.max(primary?.length ?? 0, fallback?.length ?? 0);
    },
    clear() {
      primary?.clear();
      fallback?.clear();
    },
    key(index: number) {
      return primary?.key(index) ?? fallback?.key(index) ?? null;
    },
    getItem(key: string) {
      try {
        return primary?.getItem(key) ?? fallback?.getItem(key) ?? null;
      } catch {
        try {
          return fallback?.getItem(key) ?? null;
        } catch {
          return null;
        }
      }
    },
    setItem(key: string, value: string) {
      try {
        primary?.setItem(key, value);
      } catch {
        // ignore — fallback below
      }
      try {
        fallback?.setItem(key, value);
      } catch {
        // ignore
      }
    },
    removeItem(key: string) {
      try {
        primary?.removeItem(key);
      } catch {
        // ignore
      }
      try {
        fallback?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

function safeStorage(get: () => Storage): Storage | null {
  try {
    const storage = get();
    const probe = "__ns_auth_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
