import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from "react";
import { useRadarMotion } from "@/hooks/use-radar-motion";
import type { RadarProps } from "@/components/Radar";
import { isChunkLoadError, reloadOnceForStaleChunk } from "@/lib/chunk-load-recovery";

const RadarCanvas = lazy(async () => {
  try {
    return await import("@/components/Radar");
  } catch (err) {
    if (isChunkLoadError(err)) {
      reloadOnceForStaleChunk();
      // Fallback module while reload runs (or if reload was already attempted).
      return {
        default: function RadarChunkFallback() {
          return <div className="absolute inset-0 h-full w-full" aria-hidden />;
        },
      };
    }
    throw err;
  }
});

type LazyRadarProps = RadarProps & {
  staticLabel?: string;
};

function StaticRadarFallback({
  color = "#1eb88a",
  backgroundColor = "#0d1117",
  staticLabel,
  className,
}: Readonly<LazyRadarProps>) {
  return (
    <div
      className={className ?? "absolute inset-0 h-full w-full"}
      style={{ background: backgroundColor }}
      aria-hidden
    >
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="h-[70%] w-[70%] rounded-full border-2 opacity-40"
          style={{ borderColor: color }}
        />
        <div
          className="absolute h-[45%] w-[45%] rounded-full border opacity-25"
          style={{ borderColor: color }}
        />
        {staticLabel ? <span className="absolute text-xs text-white/60">{staticLabel}</span> : null}
      </div>
    </div>
  );
}

class RadarChunkBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      reloadOnceForStaleChunk();
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function LazyRadar(props: Readonly<LazyRadarProps>) {
  const { reduceMotion, paused } = useRadarMotion();

  if (reduceMotion) {
    return <StaticRadarFallback {...props} />;
  }

  return (
    <RadarChunkBoundary fallback={<StaticRadarFallback {...props} />}>
      <Suspense fallback={<StaticRadarFallback {...props} />}>
        <RadarCanvas {...props} paused={paused || props.paused} />
      </Suspense>
    </RadarChunkBoundary>
  );
}

export type { RadarProps };
