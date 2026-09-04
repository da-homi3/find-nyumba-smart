import { getConfiguredSocialProfiles } from "@/lib/social/profiles";

const ICONS: Record<string, string> = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  facebook: "FB",
  linkedin: "IN",
  x: "X",
  whatsapp: "WA",
};

type SocialProfileLinksProps = {
  className?: string;
  /** compact = icon pills; default = text links */
  variant?: "compact" | "default";
};

/** Renders configured official profiles only — no placeholder links. */
export function SocialProfileLinks({
  className = "",
  variant = "compact",
}: Readonly<SocialProfileLinksProps>) {
  const profiles = getConfiguredSocialProfiles();
  if (profiles.length === 0) return null;

  if (variant === "default") {
    return (
      <ul className={`flex flex-wrap gap-3 text-sm ${className}`}>
        {profiles.map((p) => (
          <li key={p.platform}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer me"
              className="font-medium text-primary hover:underline"
            >
              {p.label}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {profiles.map((p) => (
        <a
          key={p.platform}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer me"
          title={p.label}
          aria-label={`NyumbaSearch on ${p.label}`}
          className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-foreground transition hover:border-primary/40 hover:text-primary"
        >
          {ICONS[p.platform] ?? p.label.slice(0, 2)}
        </a>
      ))}
    </div>
  );
}
