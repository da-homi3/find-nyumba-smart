import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, enabled]);

  return value;
}
