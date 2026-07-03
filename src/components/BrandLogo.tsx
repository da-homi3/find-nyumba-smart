import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BRAND_ICON_PATH, BRAND_LOGO_PATH } from "@/lib/brand";

type BrandLogoProps = Readonly<{
  /** Full horizontal lockup, icon-only pin, or logo without link wrapper */
  variant?: "full" | "icon";
  className?: string;
  iconClassName?: string;
  logoClassName?: string;
}>;

export function BrandLogo({
  variant = "full",
  className,
  iconClassName,
  logoClassName,
}: BrandLogoProps) {
  if (variant === "icon") {
    return (
      <img
        src={BRAND_ICON_PATH}
        alt="NyumbaSearch"
        width={36}
        height={36}
        className={cn("h-9 w-9 shrink-0 object-contain", iconClassName, className)}
      />
    );
  }

  return (
    <img
      src={BRAND_LOGO_PATH}
      alt="NyumbaSearch — Verified homes in Nairobi"
      width={220}
      height={48}
      className={cn("h-9 w-auto shrink-0 object-contain object-left", logoClassName, className)}
    />
  );
}

type BrandLogoLinkProps = BrandLogoProps &
  Readonly<{
    to?: "/" | "/tenant";
    /** When true, only show the pin on narrow headers */
    compact?: boolean;
  }>;

export function BrandLogoLink({
  to = "/",
  compact = false,
  className,
  iconClassName,
  logoClassName,
}: BrandLogoLinkProps) {
  return (
    <Link to={to} className={cn("inline-flex items-center", className)}>
      {compact ? (
        <BrandLogo variant="icon" iconClassName={iconClassName} />
      ) : (
        <BrandLogo logoClassName={logoClassName} />
      )}
    </Link>
  );
}
