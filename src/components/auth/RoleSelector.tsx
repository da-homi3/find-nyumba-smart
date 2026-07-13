import { motion, useReducedMotion } from "framer-motion";
import { Building2, Home, Search, Wrench } from "lucide-react";
import type { AccountRole } from "@/lib/account-roles";
import { MOTION_DURATION, MOTION_EASE, staggerDelay } from "@/lib/design/motion";

const ROLES = [
  {
    id: "tenant" as const,
    title: "Find a home",
    desc: "Search verified rentals in Nairobi",
    icon: Search,
  },
  {
    id: "landlord" as const,
    title: "List my property",
    desc: "Reach real tenants, no agent needed",
    icon: Home,
  },
  {
    id: "agency" as const,
    title: "Manage a portfolio",
    desc: "Bulk import, multi-agent, analytics",
    icon: Building2,
  },
  {
    id: "manager" as const,
    title: "Manage properties",
    desc: "Portfolio tools for property managers",
    icon: Wrench,
  },
];

type Props = Readonly<{
  value: AccountRole;
  onSelect: (role: AccountRole) => void;
}>;

export function RoleSelector({ value, onSelect }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      role="radiogroup"
      aria-label="Account type"
    >
      {ROLES.map((role, i) => {
        const Icon = role.icon;
        const selected = value === role.id;
        return (
          <motion.button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={selected}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: reduceMotion ? 0 : staggerDelay(i),
              duration: MOTION_DURATION.fast,
              ease: MOTION_EASE,
            }}
            whileHover={reduceMotion ? undefined : { y: -3 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            onClick={() => onSelect(role.id)}
            className={`role-select-card rounded-2xl border p-4 text-left transition-colors ${
              selected
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <Icon className="mb-2 h-5 w-5 text-primary" aria-hidden />
            <strong className="block text-sm font-semibold">{role.title}</strong>
            <p className="mt-1 text-xs text-muted-foreground">{role.desc}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
