import { useEffect, useId, useRef, useState } from "react";
import { prefersReducedMotion, useDeviceCapability } from "@/hooks/useDeviceCapability";
import {
  resolveSectorTheme,
  type PortalSector,
  type SectorTheme,
} from "@/styles/sectorThemes";

type Props = Readonly<{
  sector: PortalSector;
  className?: string;
}>;

/** Deterministic PRNG for decorative particles (not crypto). */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sector-adaptive ambient layer for portal shells.
 * Gated by device capability + prefers-reduced-motion; pointer-events none.
 */
export function SectorAmbientBackground({ sector, className }: Props) {
  const capable = useDeviceCapability();
  const theme = resolveSectorTheme(sector);
  const [visible, setVisible] = useState(false);
  const kind = theme.ambient;

  useEffect(() => {
    if (!capable || kind === "none" || prefersReducedMotion()) {
      setVisible(false);
      return;
    }
    const id = globalThis.requestAnimationFrame(() => setVisible(true));
    return () => globalThis.cancelAnimationFrame(id);
  }, [capable, kind]);

  if (kind === "none") return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      } ${className ?? ""}`}
      aria-hidden
      data-sector-ambient={sector}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${theme.washFrom}, ${theme.washTo})`,
        }}
      />
      {kind === "particles" ? <TenantParticles accent={theme.accent} /> : null}
      {kind === "breathe" ? <LandlordBreathe theme={theme} /> : null}
      {kind === "grid" ? <PortfolioGrid theme={theme} /> : null}
    </div>
  );
}

function TenantParticles({ accent }: Readonly<{ accent: string }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    type Dot = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    let dots: Dot[] = [];
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 768 ? 14 : 22;
      const rnd = mulberry32((w * 73856093) ^ (h * 19349663) ^ count);
      dots = Array.from({ length: count }, () => ({
        x: rnd() * w,
        y: rnd() * h,
        vx: (rnd() - 0.5) * 0.22,
        vy: -0.04 - rnd() * 0.12,
        r: 1.2 + rnd() * 2.4,
        a: 0.25 + rnd() * 0.35,
      }));
    };

    const tick = () => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = accent;
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.y < -8) d.y = h + 8;
        if (d.x < -8) d.x = w + 8;
        if (d.x > w + 8) d.x = -8;
        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const onVis = () => {
      running = document.visibilityState === "visible";
      if (running) raf = requestAnimationFrame(tick);
      else cancelAnimationFrame(raf);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [accent]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

function LandlordBreathe({ theme }: Readonly<{ theme: SectorTheme }>) {
  return (
    <div
      className="absolute inset-0 animate-[sector-breathe_12s_ease-in-out_infinite]"
      style={{
        background: `radial-gradient(circle at 30% 40%, ${theme.washFrom}, transparent 55%),
          radial-gradient(circle at 70% 65%, ${theme.accent}, transparent 50%)`,
      }}
    />
  );
}

function PortfolioGrid({ theme }: Readonly<{ theme: SectorTheme }>) {
  const id = useId().replaceAll(":", "");
  return (
    <svg className="absolute inset-0 h-full w-full opacity-60" aria-hidden>
      <defs>
        <pattern id={`sector-grid-${id}`} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke={theme.accent} strokeWidth="1" />
        </pattern>
        <linearGradient id={`sector-fade-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`sector-mask-${id}`}>
          <rect width="100%" height="100%" fill={`url(#sector-fade-${id})`} />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#sector-grid-${id})`}
        mask={`url(#sector-mask-${id})`}
        className="animate-[sector-grid-drift_28s_linear_infinite]"
      />
    </svg>
  );
}
