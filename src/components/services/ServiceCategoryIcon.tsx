import type { LucideIcon } from "lucide-react";
import {
  AirVent,
  Armchair,
  BatteryCharging,
  Bug,
  Droplets,
  Hammer,
  KeyRound,
  LayoutGrid,
  Leaf,
  Package,
  Paintbrush,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  Sun,
  Truck,
  WashingMachine,
  Wifi,
  Wrench,
  Zap,
  Home,
  Flame,
  Users,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const SERVICE_CATEGORY_IDS = [
  "electricians",
  "plumbers",
  "painters",
  "internet",
  "security",
  "movers",
  "cleaning",
  "solar",
  "pest_control",
  "carpentry",
  "furniture",
  "interior_design",
  "appliance_repair",
  "gardening",
  "water_services",
  "generators",
  "moving_supplies",
  "ac_repair",
  "laundry",
  "locksmiths",
  "roofing",
  "mama_fua",
  "gas_delivery",
  "delivery",
] as const;

export type ServiceCategoryId = (typeof SERVICE_CATEGORY_IDS)[number];

type CategoryIconStyle = {
  icon: LucideIcon;
  tile: string;
  iconClass: string;
};

const CATEGORY_ICON_STYLES: Record<ServiceCategoryId, CategoryIconStyle> = {
  electricians: {
    icon: Zap,
    tile: "from-amber-500/25 via-amber-400/10 to-orange-600/5",
    iconClass: "text-amber-400",
  },
  plumbers: {
    icon: Wrench,
    tile: "from-sky-500/25 via-cyan-400/10 to-blue-600/5",
    iconClass: "text-sky-400",
  },
  painters: {
    icon: Paintbrush,
    tile: "from-fuchsia-500/25 via-pink-400/10 to-rose-600/5",
    iconClass: "text-fuchsia-400",
  },
  internet: {
    icon: Wifi,
    tile: "from-violet-500/25 via-indigo-400/10 to-purple-600/5",
    iconClass: "text-violet-400",
  },
  security: {
    icon: ShieldCheck,
    tile: "from-emerald-500/25 via-teal-400/10 to-green-700/5",
    iconClass: "text-emerald-400",
  },
  movers: {
    icon: Truck,
    tile: "from-orange-500/25 via-amber-400/10 to-red-600/5",
    iconClass: "text-orange-400",
  },
  cleaning: {
    icon: Sparkles,
    tile: "from-cyan-500/25 via-sky-300/10 to-blue-500/5",
    iconClass: "text-cyan-300",
  },
  solar: {
    icon: Sun,
    tile: "from-yellow-500/30 via-amber-300/10 to-orange-500/5",
    iconClass: "text-yellow-300",
  },
  pest_control: {
    icon: Bug,
    tile: "from-lime-500/25 via-green-400/10 to-emerald-700/5",
    iconClass: "text-lime-400",
  },
  carpentry: {
    icon: Hammer,
    tile: "from-amber-700/30 via-orange-500/10 to-yellow-800/5",
    iconClass: "text-amber-500",
  },
  furniture: {
    icon: Armchair,
    tile: "from-stone-500/25 via-neutral-400/10 to-zinc-600/5",
    iconClass: "text-stone-300",
  },
  interior_design: {
    icon: LayoutGrid,
    tile: "from-rose-500/25 via-pink-400/10 to-fuchsia-700/5",
    iconClass: "text-rose-400",
  },
  appliance_repair: {
    icon: WashingMachine,
    tile: "from-slate-500/25 via-gray-400/10 to-zinc-700/5",
    iconClass: "text-slate-300",
  },
  gardening: {
    icon: Leaf,
    tile: "from-green-500/25 via-lime-400/10 to-emerald-700/5",
    iconClass: "text-green-400",
  },
  water_services: {
    icon: Droplets,
    tile: "from-blue-500/25 via-sky-400/10 to-indigo-600/5",
    iconClass: "text-blue-400",
  },
  generators: {
    icon: BatteryCharging,
    tile: "from-yellow-600/25 via-amber-500/10 to-orange-700/5",
    iconClass: "text-amber-400",
  },
  moving_supplies: {
    icon: Package,
    tile: "from-orange-400/25 via-amber-300/10 to-yellow-600/5",
    iconClass: "text-orange-300",
  },
  ac_repair: {
    icon: Snowflake,
    tile: "from-cyan-400/25 via-sky-300/10 to-blue-500/5",
    iconClass: "text-cyan-200",
  },
  laundry: {
    icon: Shirt,
    tile: "from-indigo-500/25 via-violet-400/10 to-purple-700/5",
    iconClass: "text-indigo-300",
  },
  locksmiths: {
    icon: KeyRound,
    tile: "from-zinc-500/25 via-neutral-400/10 to-stone-600/5",
    iconClass: "text-zinc-300",
  },
  roofing: {
    icon: Home,
    tile: "from-red-600/25 via-orange-500/10 to-amber-700/5",
    iconClass: "text-red-400",
  },
  mama_fua: {
    icon: Users,
    tile: "from-pink-500/25 via-rose-400/10 to-fuchsia-700/5",
    iconClass: "text-pink-300",
  },
  gas_delivery: {
    icon: Flame,
    tile: "from-orange-600/30 via-red-500/10 to-amber-600/5",
    iconClass: "text-orange-400",
  },
  delivery: {
    icon: PackageCheck,
    tile: "from-blue-500/25 via-indigo-400/10 to-violet-600/5",
    iconClass: "text-blue-300",
  },
};

const FALLBACK_STYLE: CategoryIconStyle = {
  icon: AirVent,
  tile: "from-primary/20 via-primary/10 to-primary/5",
  iconClass: "text-primary",
};

const SIZE_CLASSES = {
  sm: { tile: "h-9 w-9 rounded-xl", icon: "h-4 w-4" },
  md: { tile: "h-11 w-11 rounded-2xl", icon: "h-5 w-5" },
  lg: { tile: "h-14 w-14 rounded-2xl", icon: "h-7 w-7" },
} as const;

const TILE_SHELL_CLASSES =
  "inline-flex shrink-0 items-center justify-center border border-white/10 bg-linear-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";

const DECORATIVE_ICON_PROPS = { "aria-hidden": true } as const;

type ServiceCategoryIconProps = Readonly<{
  categoryId: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}>;

export function ServiceCategoryIcon({
  categoryId,
  size = "md",
  className,
}: ServiceCategoryIconProps) {
  const style = CATEGORY_ICON_STYLES[categoryId as ServiceCategoryId] ?? FALLBACK_STYLE;
  const Icon = style.icon;
  const dims = SIZE_CLASSES[size];
  const tileClassName = cn(TILE_SHELL_CLASSES, dims.tile, style.tile, className);

  return (
    <span className={tileClassName} {...DECORATIVE_ICON_PROPS}>
      <Icon className={cn(dims.icon, style.iconClass)} strokeWidth={2.25} />
    </span>
  );
}
