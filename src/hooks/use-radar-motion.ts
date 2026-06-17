import { useEffect, useState } from "react";

export function useRadarMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(mq.matches);
    syncMotion();
    mq.addEventListener("change", syncMotion);

    const onVisibility = () => setHidden(globalThis.document.hidden);
    globalThis.document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    return () => {
      mq.removeEventListener("change", syncMotion);
      globalThis.document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { reduceMotion, paused: hidden };
}
