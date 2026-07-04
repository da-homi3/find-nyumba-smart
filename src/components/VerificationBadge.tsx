import { ShieldCheck, CheckCircle2, Building, ShieldAlert } from "lucide-react";

const VERIFY_COLORS: Record<number, string> = {
  1: "var(--verify-l1)",
  2: "var(--verify-l2)",
  3: "var(--verify-l3)",
  4: "var(--verify-l4)",
};

interface VerificationBadgeProps {
  level: number;
  showText?: boolean;
  variant?: "default" | "glass";
}

export function VerificationBadge({
  level,
  showText = true,
  variant = "default",
}: Readonly<VerificationBadgeProps>) {
  if (level <= 0) return null;

  const config = {
    1: {
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
      label: "Phone Verified",
      icon: CheckCircle2,
    },
    2: {
      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25",
      label: "ID Verified",
      icon: ShieldCheck,
    },
    3: {
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
      label: "Business Verified",
      icon: Building,
    },
    4: {
      color:
        "bg-gradient-gold/10 text-amber-600 dark:text-amber-400 border-amber-500/25 bg-amber-500/15",
      label: "Ownership Verified",
      icon: ShieldCheck,
    },
  }[level as 1 | 2 | 3 | 4] || {
    color: "bg-gray-500/10 text-gray-600 border-gray-500/25",
    label: "Unverified",
    icon: ShieldAlert,
  };

  if (variant === "glass") {
    const dotColor = VERIFY_COLORS[level] ?? "var(--verify-l1)";
    return (
      <span
        className="verify-badge-glass pointer-events-none"
        style={{ ["--badge-color" as string]: dotColor }}
      >
        <span className="verify-dot" aria-hidden />
        {showText && <span>{config.label}</span>}
      </span>
    );
  }

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${config.color}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {showText && <span>{config.label}</span>}
    </span>
  );
}
