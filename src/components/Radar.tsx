import { useEffect, useRef, type MouseEvent } from "react";

export type RadarProps = {
  speed?: number;
  scale?: number;
  ringCount?: number;
  spokeCount?: number;
  ringThickness?: number;
  spokeThickness?: number;
  sweepSpeed?: number;
  sweepWidth?: number;
  sweepLobes?: number;
  color?: string;
  backgroundColor?: string;
  falloff?: number;
  brightness?: number;
  enableMouseInteraction?: boolean;
  mouseInfluence?: number;
  paused?: boolean;
  className?: string;
};

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Radar({
  speed = 1,
  scale = 0.5,
  ringCount = 10,
  spokeCount = 10,
  ringThickness = 0.05,
  spokeThickness = 0.01,
  sweepSpeed = 1,
  sweepWidth = 2,
  sweepLobes = 1,
  color = "#1eb88a",
  backgroundColor = "#0d1117",
  falloff = 2,
  brightness = 1,
  enableMouseInteraction = false,
  mouseInfluence = 0.1,
  paused = false,
  className,
}: Readonly<RadarProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const angleRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || paused) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const dpr = globalThis.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      angleRef.current += sweepSpeed * speed * dt;

      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const mx = enableMouseInteraction ? (mouseRef.current.x - 0.5) * mouseInfluence : 0;
      const my = enableMouseInteraction ? (mouseRef.current.y - 0.5) * mouseInfluence : 0;
      const cx = w * (0.5 + mx);
      const cy = h * (0.5 + my);
      const maxR = Math.min(w, h) * 0.5 * scale;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);

      for (let i = 1; i <= ringCount; i++) {
        const r = (maxR * i) / ringCount;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = hexWithAlpha(color, 0.18 * brightness);
        ctx.lineWidth = Math.max(0.5, ringThickness * maxR);
        ctx.stroke();
      }

      for (let i = 0; i < spokeCount; i++) {
        const a = (Math.PI * 2 * i) / spokeCount;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.strokeStyle = hexWithAlpha(color, 0.14 * brightness);
        ctx.lineWidth = Math.max(0.5, spokeThickness * maxR);
        ctx.stroke();
      }

      const sweepRad = (sweepWidth * Math.PI) / 180;
      for (let lobe = 0; lobe < sweepLobes; lobe++) {
        const lobeOffset = (Math.PI * 2 * lobe) / sweepLobes;
        const start = angleRef.current + lobeOffset - sweepRad / 2;
        const end = angleRef.current + lobeOffset + sweepRad / 2;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        grad.addColorStop(0, hexWithAlpha(color, 0.4 * brightness));
        grad.addColorStop(0.55, hexWithAlpha(color, 0.12 * brightness));
        grad.addColorStop(1, hexWithAlpha(color, 0));

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, start, end);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.globalCompositeOperation = "lighter";
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      const glowR = maxR / Math.max(falloff, 0.5);
      const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      centerGlow.addColorStop(0, hexWithAlpha(color, 0.1 * brightness));
      centerGlow.addColorStop(1, "transparent");
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [
    paused,
    speed,
    scale,
    ringCount,
    spokeCount,
    ringThickness,
    spokeThickness,
    sweepSpeed,
    sweepWidth,
    sweepLobes,
    color,
    backgroundColor,
    falloff,
    brightness,
    enableMouseInteraction,
    mouseInfluence,
  ]);

  function handleMouseMove(e: MouseEvent<HTMLCanvasElement>) {
    if (!enableMouseInteraction) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  if (enableMouseInteraction) {
    return (
      <canvas
        ref={canvasRef}
        className={className ?? "absolute inset-0 h-full w-full"}
        onMouseMove={handleMouseMove}
      />
    );
  }

  return (
    <div className={className ?? "absolute inset-0 h-full w-full"} aria-hidden>
      <canvas ref={canvasRef} className="pointer-events-none h-full w-full" />
    </div>
  );
}
