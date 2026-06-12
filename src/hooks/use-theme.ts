import { useEffect, useState } from "react";

const STORAGE_KEY = "nyumba_theme";

export type ThemeMode = "light" | "dark" | "system";

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system" && typeof globalThis.matchMedia !== "undefined") {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode === "dark" ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  if (typeof globalThis.document === "undefined") return;
  const resolved = resolveTheme(mode);
  globalThis.document.documentElement.classList.toggle("dark", resolved === "dark");
  globalThis.document.documentElement.dataset.theme = resolved;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof globalThis.localStorage === "undefined") return "system";
    return (globalThis.localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? "system";
  });

  useEffect(() => {
    applyTheme(mode);
    if (mode === "system" && typeof globalThis.matchMedia !== "undefined") {
      const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme("system");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    globalThis.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  return { mode, setMode, resolved: resolveTheme(mode) };
}
