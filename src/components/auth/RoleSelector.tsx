import { motion, useReducedMotion } from "framer-motion";
import { Building2, HardHat, Home, Search, UserRound, Wrench } from "lucide-react";
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
    desc: "Reach real tenants as a verified property owner",
    icon: Home,
  },
  {
    id: "agency" as const,
    title: "Manage a portfolio",
    desc: "Bulk import, multi-agent, analytics",
    icon: Building2,
  },
  {
    id: "property_developer" as const,
    title: "Property developer",
    desc: "Publish projects and units under your brand",
    icon: HardHat,
  },
  {
    id: "agent" as const,
    title: "Real estate agent",
    desc: "List and manage client properties as an agent",
    icon: UserRound,
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
              ease: MOTION_EASE.out,
            }}
            onClick={() => onSelect(role.id)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
              selected
                ? "border-primary bg-primary/5 shadow-soft"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <span
              className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-sm font-semibold">{role.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{role.desc}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
