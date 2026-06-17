import { Suspense, lazy } from "react";
import { useRadarMotion } from "@/hooks/use-radar-motion";
import type { RadarProps } from "@/components/Radar";

const RadarCanvas = lazy(() => import("@/components/Radar"));

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
        {staticLabel ? (
          <span className="absolute text-xs text-white/60">{staticLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

export function LazyRadar(props: Readonly<LazyRadarProps>) {
  const { reduceMotion, paused } = useRadarMotion();

  if (reduceMotion) {
    return <StaticRadarFallback {...props} />;
  }

  return (
    <Suspense fallback={<StaticRadarFallback {...props} />}>
      <RadarCanvas {...props} paused={paused || props.paused} />
    </Suspense>
  );
}

export type { RadarProps };
