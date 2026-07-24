import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/hooks/useDeviceCapability";
import { isLiteServeMode } from "@/lib/app-client";

type ParticleKind =
  | "leaf"
  | "dot"
  | "house"
  | "pin"
  | "key"
  | "building"
  | "wrench"
  | "diamond"
  | "tri"
  | "hex";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  kind: ParticleKind;
  alpha: number;
  phase: number;
  phaseSpeed: number;
  wander: number;
};

type AmbientBudget = {
  lowEnd: boolean;
  count: number;
};

/** Weighted toward soft ambient dots; icons stay sparse. */
const KINDS: ParticleKind[] = [
  "dot",
  "dot",
  "leaf",
  "leaf",
  "pin",
  "key",
  "house",
  "building",
  "wrench",
  "diamond",
  "tri",
  "hex",
];

const SIMPLE_KINDS: ParticleKind[] = ["dot", "leaf", "pin", "key", "house", "diamond"];

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

function resolveAmbientBudget(): AmbientBudget {
  if (globalThis.window === undefined) {
    return { lowEnd: true, count: 18 };
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory < 4;
  const saveData = Boolean(nav.connection?.saveData);
  const narrow = globalThis.window.innerWidth < 768;
  const lowEnd = lowMemory || saveData;
  if (lowEnd) return { lowEnd: true, count: 18 };
  if (narrow) return { lowEnd: false, count: 30 };
  return { lowEnd: false, count: 44 };
}

function createParticles(count: number, w: number, h: number, lowEnd: boolean): Particle[] {
  const rnd = mulberry32((w * 73856093) ^ (h * 19349663) ^ count);
  const pool = lowEnd ? SIMPLE_KINDS : KINDS;
  return Array.from({ length: count }, () => {
    const speed = 0.05 + rnd() * 0.16;
    const angle = rnd() * Math.PI * 2;
    return {
      x: rnd() * w,
      y: rnd() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.65 - 0.02,
      size: lowEnd ? 11 + rnd() * 16 : 10 + rnd() * 20,
      rot: rnd() * Math.PI * 2,
      vr: (rnd() - 0.5) * 0.01,
      kind: pool[Math.floor(rnd() * pool.length)]!,
      alpha: 0.2 + rnd() * 0.12,
      phase: rnd() * Math.PI * 2,
      phaseSpeed: 0.002 + rnd() * 0.007,
      wander: 0.2 + rnd() * 0.55,
    };
  });
}

function strokePath(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.beginPath();
  draw();
  ctx.stroke();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, color: string) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.85;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const s = p.size;

  switch (p.kind) {
    case "leaf":
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.32, s * 0.68, 0.35, 0, Math.PI * 2);
      ctx.fill();
      strokePath(ctx, () => {
        ctx.moveTo(0, -s * 0.55);
        ctx.lineTo(0, s * 0.55);
      });
      break;
    case "pin":
      ctx.beginPath();
      ctx.arc(0, -s * 0.18, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, 0);
      ctx.lineTo(0, s * 0.55);
      ctx.lineTo(s * 0.22, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case "key":
      strokePath(ctx, () => {
        ctx.arc(-s * 0.28, 0, s * 0.26, 0, Math.PI * 2);
      });
      ctx.fillRect(-s * 0.02, -s * 0.07, s * 0.58, s * 0.14);
      ctx.fillRect(s * 0.32, s * 0.07, s * 0.1, s * 0.18);
      ctx.fillRect(s * 0.44, s * 0.07, s * 0.1, s * 0.12);
      break;
    case "house":
      strokePath(ctx, () => {
        ctx.moveTo(0, -s * 0.55);
        ctx.lineTo(s * 0.48, -s * 0.08);
        ctx.lineTo(s * 0.48, s * 0.48);
        ctx.lineTo(-s * 0.48, s * 0.48);
        ctx.lineTo(-s * 0.48, -s * 0.08);
        ctx.closePath();
      });
      strokePath(ctx, () => {
        ctx.rect(-s * 0.1, s * 0.12, s * 0.2, s * 0.36);
      });
      break;
    case "building":
      strokePath(ctx, () => {
        ctx.rect(-s * 0.4, -s * 0.5, s * 0.8, s);
      });
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = -s * 0.22 + col * s * 0.28;
          const wy = -s * 0.32 + row * s * 0.28;
          ctx.fillRect(wx, wy, s * 0.12, s * 0.12);
        }
      }
      break;
    case "wrench":
      strokePath(ctx, () => {
        ctx.moveTo(-s * 0.4, -s * 0.35);
        ctx.quadraticCurveTo(-s * 0.55, 0, -s * 0.25, s * 0.15);
        ctx.lineTo(s * 0.45, s * 0.45);
        ctx.moveTo(-s * 0.15, -s * 0.45);
        ctx.quadraticCurveTo(s * 0.05, -s * 0.55, s * 0.15, -s * 0.25);
      });
      break;
    case "diamond":
      strokePath(ctx, () => {
        ctx.moveTo(0, -s * 0.5);
        ctx.lineTo(s * 0.38, 0);
        ctx.lineTo(0, s * 0.5);
        ctx.lineTo(-s * 0.38, 0);
        ctx.closePath();
      });
      break;
    case "tri":
      strokePath(ctx, () => {
        ctx.moveTo(0, -s * 0.48);
        ctx.lineTo(s * 0.42, s * 0.4);
        ctx.lineTo(-s * 0.42, s * 0.4);
        ctx.closePath();
      });
      break;
    case "hex": {
      const r = s * 0.42;
      strokePath(ctx, () => {
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      });
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}

/**
 * Global ambient particle field. Renders above page backgrounds (below nav)
 * so it is visible on every screen without blocking taps.
 */
export function AmbientBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [budget, setBudget] = useState<AmbientBudget>({ lowEnd: true, count: 14 });

  useEffect(() => {
    setBudget(resolveAmbientBudget());
  }, []);

  useEffect(() => {
    if (isLiteServeMode() || prefersReducedMotion()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const { lowEnd, count } = budget;
    let particles = createParticles(count, 1, 1, lowEnd);
    let raf = 0;
    let running = true;
    let color = "rgba(10, 143, 61, 0.28)";
    let lastTs = 0;

    const readColor = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--ambient-particle")
        .trim();
      if (raw) color = raw;
    };

    const resize = () => {
      const next = resolveAmbientBudget();
      const dpr = Math.min(window.devicePixelRatio || 1, next.lowEnd ? 1 : 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(next.count, w, h, next.lowEnd);
    };

    const tick = (ts: number) => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (lowEnd && lastTs && ts - lastTs < 33) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastTs = ts;

      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.phase += p.phaseSpeed;
        p.x += p.vx + Math.sin(p.phase) * p.wander * 0.35;
        p.y += p.vy + Math.cos(p.phase * 0.85) * p.wander * 0.25;
        p.rot += p.vr;
        if (p.y < -36) p.y = h + 36;
        if (p.y > h + 36) p.y = -36;
        if (p.x < -36) p.x = w + 36;
        if (p.x > w + 36) p.x = -36;
        drawParticle(ctx, p, color);
      }
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (running) {
        lastTs = 0;
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    readColor();
    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    const themeObs = new MutationObserver(readColor);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObs.disconnect();
    };
  }, [budget]);

  if (isLiteServeMode()) return null;

  return (
    <div className="ambient-backdrop" aria-hidden data-ambient="particles-v2">
      <canvas ref={canvasRef} />
    </div>
  );
}
