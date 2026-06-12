type Props = {
  label?: "Ad" | "Sponsored" | "Partner";
  title: string;
  body: string;
  cta?: string;
  href?: string;
  variant?: "banner" | "card";
};

export function AdUnit({
  label = "Ad",
  title,
  body,
  cta = "Learn more",
  href = "#",
  variant = "card",
}: Readonly<Props>) {
  if (variant === "banner") {
    return (
      <a
        href={href}
        className="relative block overflow-hidden rounded-2xl border bg-secondary/60 px-4 py-3 sm:py-4"
      >
        <span className="absolute right-2 top-2 rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
          {label}
        </span>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </a>
    );
  }

  return (
    <a
      href={href}
      className="relative block rounded-2xl border bg-card p-4 shadow-soft hover:border-primary/30"
    >
      <span className="absolute right-3 top-3 rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
        {label}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      <span className="mt-2 inline-block text-xs font-semibold text-primary">{cta} →</span>
    </a>
  );
}
