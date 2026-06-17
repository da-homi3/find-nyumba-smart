import type { ReactNode } from "react";
import { LazyRadar } from "@/components/LazyRadar";
import type { RadarProps } from "@/components/LazyRadar";

type RadarScanProps = Readonly<
  RadarProps & {
    label?: string;
    height?: number | string;
    className?: string;
  }
>;

/** Shared radar loading shell with optional centered label. */
export function RadarScanPanel({
  label,
  height = 200,
  className = "",
  children,
  ...radarProps
}: RadarScanProps & { children?: ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{ height, background: radarProps.backgroundColor ?? "#0d1117" }}
    >
      <LazyRadar {...radarProps} />
      {label ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
          <span className="text-center text-sm text-white/70">{label}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
