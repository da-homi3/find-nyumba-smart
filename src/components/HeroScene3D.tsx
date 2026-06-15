import { useEffect, useRef } from "react";
import { prefersReducedMotion, shouldUseHeavy3D } from "@/lib/motion/performance";
import { createHeroScene } from "./hero-scene/createHeroScene";

type HeroScene3DProps = Readonly<{
  backdropUrl: string;
}>;

export function HeroScene3D({ backdropUrl }: HeroScene3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldUseHeavy3D()) return;

    let handle: { dispose: () => void } | null = null;
    let cancelled = false;

    void createHeroScene(canvas, backdropUrl).then((h) => {
      if (cancelled) {
        h.dispose();
        return;
      }
      handle = h;
    });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, [backdropUrl]);

  if (prefersReducedMotion() || !shouldUseHeavy3D()) return null;

  return (
    <div className="absolute inset-0 h-full w-full" aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
