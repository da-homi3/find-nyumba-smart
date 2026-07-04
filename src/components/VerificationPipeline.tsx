import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Smartphone, BadgeCheck, Building2, Camera, type LucideIcon } from "lucide-react";
import { isTouchDevice } from "@/lib/motion/performance";
import { prefersReducedMotion } from "@/hooks/useDeviceCapability";

const LEVELS = [
  {
    n: 1,
    title: "Phone verified",
    desc: "Landlord reachable via verified line.",
    color: "var(--verify-l1)",
    glow: "rgba(100, 116, 139, 0.45)",
    icon: Smartphone,
    progress: 25,
  },
  {
    n: 2,
    title: "ID verified",
    desc: "National ID matched to landlord profile.",
    color: "var(--verify-l2)",
    glow: "rgba(66, 153, 225, 0.45)",
    icon: BadgeCheck,
    progress: 50,
  },
  {
    n: 3,
    title: "Business verified",
    desc: "Registered agency or property company.",
    color: "var(--verify-l3)",
    glow: "rgba(30, 184, 138, 0.5)",
    icon: Building2,
    progress: 75,
  },
  {
    n: 4,
    title: "Ownership verified",
    desc: "Title deed or lease cross-checked.",
    color: "var(--verify-l4)",
    glow: "rgba(246, 173, 85, 0.5)",
    icon: Camera,
    progress: 100,
  },
] as const;

type Level = (typeof LEVELS)[number];

function VerifyNode3D({
  level,
  index,
  active,
  onHover,
}: Readonly<{
  level: Level;
  index: number;
  active: boolean;
  onHover: (n: number | null) => void;
}>) {
  const cardRef = useRef<HTMLDivElement>(null);
  const touch = isTouchDevice();
  const reduced = prefersReducedMotion();
  const enable3D = !touch && !reduced;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-80, 80], [8, -8]), {
    stiffness: 280,
    damping: 28,
  });
  const rotateY = useSpring(useTransform(x, [-80, 80], [-8, 8]), {
    stiffness: 280,
    damping: 28,
  });

  const Icon = level.icon as LucideIcon;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enable3D) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    onHover(null);
  };

  return (
    <motion.div
      ref={cardRef}
      className="verify-node-3d relative"
      initial={{ opacity: 0, y: 32, rotateX: 12 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: index * 0.12, ease: [0.19, 1, 0.22, 1] }}
      onMouseEnter={() => onHover(level.n)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        enable3D
          ? {
              rotateX,
              rotateY,
              transformPerspective: 900,
              transformStyle: "preserve-3d",
            }
          : undefined
      }
      whileHover={enable3D ? { scale: 1.03, y: -6 } : { y: -4 }}
    >
      <motion.div
        className="verify-node-card relative overflow-hidden rounded-[20px] border border-white/8 bg-(--surface-1) p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]"
        animate={{
          borderColor: active ? "rgba(30,184,138,0.35)" : "rgba(255,255,255,0.08)",
          boxShadow: active
            ? `0 24px 60px ${level.glow}, 0 0 0 1px rgba(30,184,138,0.2)`
            : "0 8px 32px rgba(0,0,0,0.28)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500"
          style={{
            background: level.color,
            opacity: active ? 0.35 : 0,
          }}
          aria-hidden
        />

        <div className="flex items-start justify-between gap-3">
          <motion.div
            className="verify-node-badge relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white"
            style={{
              background: level.color,
              boxShadow: active ? `0 0 24px ${level.glow}` : "0 4px 16px rgba(0,0,0,0.25)",
            }}
            animate={{ scale: active ? 1.08 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <span className="relative z-10">{level.n}</span>
            <motion.span
              className="absolute inset-0 rounded-2xl"
              style={{ border: `2px solid ${level.color}` }}
              animate={{ scale: active ? 1.35 : 1, opacity: active ? 0 : 0.6 }}
              transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatDelay: 0.2 }}
              aria-hidden
            />
            <Icon className="absolute bottom-1 right-1 h-3.5 w-3.5 opacity-40" aria-hidden />
          </motion.div>

          <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Level {level.n}
          </span>
        </div>

        <h4 className="mt-4 font-display text-base font-semibold">{level.title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{level.desc}</p>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/8">
          <motion.div
            className="verify-node-progress h-full rounded-full"
            style={{ background: level.color }}
            initial={{ width: 0 }}
            whileInView={{ width: `${level.progress}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.15 + index * 0.1, ease: "easeOut" }}
          />
        </div>
      </motion.div>

      {index < LEVELS.length - 1 ? (
        <span
          className="verify-node-connector pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 lg:block"
          style={{
            background: active
              ? `linear-gradient(90deg, ${level.color}, transparent)`
              : "rgba(255,255,255,0.08)",
          }}
          aria-hidden
        />
      ) : null}
    </motion.div>
  );
}

export function VerificationPipeline() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="verify-pipeline relative mt-4 lg:mt-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-60"
        style={{ background: "var(--surface-glow)" }}
        aria-hidden
      />

      <svg
        className="verify-pipeline-line pointer-events-none absolute left-[8%] right-[8%] top-[72px] hidden h-2 lg:block"
        viewBox="0 0 800 8"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="verify-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--verify-l1)" />
            <stop offset="33%" stopColor="var(--verify-l2)" />
            <stop offset="66%" stopColor="var(--verify-l3)" />
            <stop offset="100%" stopColor="var(--verify-l4)" />
          </linearGradient>
          <filter id="verify-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <line x1="0" y1="4" x2="800" y2="4" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <motion.line
          x1="0"
          y1="4"
          x2="800"
          y2="4"
          stroke="url(#verify-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#verify-glow)"
          initial={{ pathLength: 0, opacity: 0.5 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
        <AnimatePresence>
          {typeof hovered === "number" ? (
            <motion.circle
              key={hovered}
              r="5"
              cy="4"
              fill={LEVELS[hovered - 1]?.color ?? "#1eb88a"}
              initial={{ opacity: 0, cx: ((hovered - 1) / 3) * 800 }}
              animate={{
                opacity: [0.6, 1, 0.6],
                cx: [((hovered - 1) / 3) * 800, (hovered / 3) * 800],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
        </AnimatePresence>
      </svg>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {LEVELS.map((lv, i) => (
          <VerifyNode3D
            key={lv.n}
            level={lv}
            index={i}
            active={hovered === lv.n}
            onHover={setHovered}
          />
        ))}
      </div>
    </div>
  );
}
