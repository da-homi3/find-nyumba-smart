import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nyumba-theme";

export type ThemeMode = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

function readMode(): ThemeMode {
  if (globalThis.window === undefined) return "dark";
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "dark";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== "system") return mode;
  if (globalThis.window === undefined) return "dark";
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light-mode", theme === "light");
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => readMode());
  const theme = resolveTheme(mode);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, theme]);

  useEffect(() => {
    if (mode !== "system" || globalThis.window === undefined) return;
    const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return {
    mode,
    setMode: setTheme,
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
