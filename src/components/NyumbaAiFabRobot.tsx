import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/hooks/useDeviceCapability";

const SCENES = ["build", "drive", "search", "key"] as const;
type Scene = (typeof SCENES)[number];

/**
 * Tiny robot mascot for the NyumbaAI FAB — cycles through housing-related actions.
 */
export function NyumbaAiFabRobot() {
  const [scene, setScene] = useState<Scene>("build");
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setMotionOk(true);
    const id = window.setInterval(() => {
      setScene((prev) => {
        const i = SCENES.indexOf(prev);
        return SCENES[(i + 1) % SCENES.length]!;
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <svg
      viewBox="0 0 48 48"
      className={`nyumba-ai-fab-robot h-7 w-7 ${motionOk ? "is-animated" : ""}`}
      aria-hidden
      data-scene={scene}
    >
      {/* Soft glow */}
      <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.08" />

      {/* Robot body */}
      <g className="fab-robot-body">
        <rect x="16" y="18" width="16" height="14" rx="3.5" fill="currentColor" />
        <rect x="18" y="12" width="12" height="8" rx="3" fill="currentColor" />
        <circle cx="21.5" cy="15.5" r="1.4" fill="#0a5c47" />
        <circle cx="26.5" cy="15.5" r="1.4" fill="#0a5c47" />
        <rect x="21" y="17.2" width="6" height="1.2" rx="0.6" fill="#0a5c47" opacity="0.55" />
        {/* Antenna */}
        <line
          x1="24"
          y1="12"
          x2="24"
          y2="8.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle className="fab-robot-antenna" cx="24" cy="7.5" r="1.6" fill="#ffd54f" />
        {/* Arms */}
        <g className="fab-robot-arm-l">
          <line
            x1="16"
            y1="22"
            x2="11"
            y2="26"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
        <g className="fab-robot-arm-r">
          <line
            x1="32"
            y1="22"
            x2="37"
            y2="26"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
        {/* Legs */}
        <line
          x1="20"
          y1="32"
          x2="18.5"
          y2="38"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          x1="28"
          y1="32"
          x2="29.5"
          y2="38"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>

      {/* Scene props — only one active at a time */}
      <g className="fab-scene fab-scene-build" opacity={scene === "build" ? 1 : 0}>
        <path
          className="fab-house"
          d="M6 28 L12 22 L18 28 V36 H6 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <rect x="10" y="30" width="3.2" height="6" rx="0.4" fill="currentColor" opacity="0.85" />
        <g className="fab-hammer">
          <rect x="34.5" y="18" width="6" height="3" rx="0.6" fill="#ffd54f" />
          <line
            x1="37.5"
            y1="21"
            x2="37.5"
            y2="28"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>

      <g className="fab-scene fab-scene-drive" opacity={scene === "drive" ? 1 : 0}>
        <g className="fab-car">
          <path
            d="M8 34 H30 L33 30 H27 L24 26 H14 L11 30 H8 Z"
            fill="currentColor"
            opacity="0.95"
          />
          <rect x="15" y="27.2" width="4" height="2.4" rx="0.4" fill="#0a5c47" opacity="0.5" />
          <rect x="21" y="27.2" width="4" height="2.4" rx="0.4" fill="#0a5c47" opacity="0.5" />
          <circle cx="13" cy="34.5" r="2.2" fill="#ffd54f" />
          <circle cx="26" cy="34.5" r="2.2" fill="#ffd54f" />
        </g>
      </g>

      <g className="fab-scene fab-scene-search" opacity={scene === "search" ? 1 : 0}>
        <g className="fab-pin">
          <path d="M38 16 c0-3.3-2.7-6-6-6s-6 2.7-6 6c0 4.5 6 10 6 10s6-5.5 6-10z" fill="#ffd54f" />
          <circle cx="32" cy="16" r="2" fill="#0a5c47" />
        </g>
        <circle
          className="fab-radar"
          cx="12"
          cy="34"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity="0.7"
        />
      </g>

      <g className="fab-scene fab-scene-key" opacity={scene === "key" ? 1 : 0}>
        <g className="fab-key">
          <circle cx="10" cy="24" r="3.2" fill="none" stroke="#ffd54f" strokeWidth="1.8" />
          <line
            x1="13"
            y1="24"
            x2="22"
            y2="24"
            stroke="#ffd54f"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="19"
            y1="24"
            x2="19"
            y2="27"
            stroke="#ffd54f"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="21.2"
            y1="24"
            x2="21.2"
            y2="26.2"
            stroke="#ffd54f"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
