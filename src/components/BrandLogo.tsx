import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BRAND_ICON_DISPLAY_PATH, BRAND_LOGO_DISPLAY_PATH } from "@/lib/brand";

type BrandLogoProps = Readonly<{
  /** Full mark or compact icon-only mark */
  variant?: "full" | "icon";
  className?: string;
  iconClassName?: string;
  logoClassName?: string;
  /** Use high fetch priority only for above-the-fold homepage/nav LCP. */
  priority?: boolean;
}>;

export function BrandLogo({
  variant = "full",
  className,
  iconClassName,
  logoClassName,
  priority = false,
}: BrandLogoProps) {
  if (variant === "icon") {
    return (
      <img
        src={BRAND_ICON_DISPLAY_PATH}
        alt="NyumbaSearch"
        width={36}
        height={36}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn("h-9 w-9 shrink-0 rounded-lg object-contain", iconClassName, className)}
      />
    );
  }

  return (
    <img
      src={BRAND_LOGO_DISPLAY_PATH}
      alt="NyumbaSearch — Verified homes in Nairobi"
      width={40}
      height={40}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn("h-9 w-auto shrink-0 rounded-lg object-contain", logoClassName, className)}
    />
  );
}

type BrandLogoLinkProps = BrandLogoProps &
  Readonly<{
    to?: "/" | "/tenant";
    /** When true, only show the compact mark on narrow headers */
    compact?: boolean;
  }>;

export function BrandLogoLink({
  to = "/",
  compact = false,
  className,
  iconClassName,
  logoClassName,
  priority = false,
}: BrandLogoLinkProps) {
  return (
    <Link to={to} className={cn("inline-flex items-center", className)}>
      {compact ? (
        <BrandLogo variant="icon" iconClassName={iconClassName} priority={priority} />
      ) : (
        <BrandLogo logoClassName={logoClassName} priority={priority} />
      )}
    </Link>
  );
}
