import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Facebook, Link2, Mail, MessageCircle, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  copyTextToClipboard,
  emailShareUrl,
  facebookShareUrl,
  listingShareText,
  listingShareUrl,
  nativeShareListing,
  smsShareUrl,
  telegramShareUrl,
  twitterShareUrl,
  whatsappShareUrl,
} from "@/lib/share-listing";
import type { Property } from "@/lib/properties";

type ShareListingButtonProps = Readonly<{
  property: Pick<Property, "id" | "title" | "neighborhood" | "rent_kes">;
  className?: string;
  /** Gallery-style circular control. */
  variant?: "icon" | "chip" | "card";
  children?: ReactNode;
}>;

type Channel = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void | Promise<void>;
  icon: ReactNode;
};

export function ShareListingButton({
  property,
  className,
  variant = "icon",
  children,
}: ShareListingButtonProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const url = listingShareUrl(property.id);
  const text = listingShareText(property);
  const title = property.title || "NyumbaSearch listing";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function copyLink() {
    const ok = await copyTextToClipboard(url);
    if (!ok) {
      toast.error("Could not copy link");
      return;
    }
    setCopied(true);
    toast.success("Link copied — paste it anywhere");
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function shareNative() {
    const result = await nativeShareListing({ title, text, url });
    if (result === "shared") {
      setOpen(false);
      return;
    }
    if (result === "copied") {
      setCopied(true);
      toast.success("Link copied");
      return;
    }
    if (result === "failed") toast.error("Could not share this listing");
  }

  const channels: Channel[] = [
    {
      id: "native",
      label: "Share…",
      onClick: shareNative,
      icon: <Share2 className="h-4 w-4" />,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: whatsappShareUrl(url, text),
      icon: <MessageCircle className="h-4 w-4 text-[#25D366]" />,
    },
    {
      id: "facebook",
      label: "Facebook",
      href: facebookShareUrl(url),
      icon: <Facebook className="h-4 w-4 text-[#1877F2]" />,
    },
    {
      id: "x",
      label: "X / Twitter",
      href: twitterShareUrl(url, text),
      icon: <span className="text-xs font-bold">𝕏</span>,
    },
    {
      id: "telegram",
      label: "Telegram",
      href: telegramShareUrl(url, text),
      icon: <SendIcon />,
    },
    {
      id: "sms",
      label: "Messages",
      href: smsShareUrl(url, text),
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      id: "email",
      label: "Email",
      href: emailShareUrl(url, title, text),
      icon: <Mail className="h-4 w-4" />,
    },
    {
      id: "copy",
      label: copied ? "Copied" : "Copy link",
      onClick: copyLink,
      icon: copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />,
    },
  ];

  const sheet =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
            <button
              type="button"
              aria-label="Dismiss share sheet"
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <div
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Share listing"
              className="relative z-10 w-full max-w-md rounded-t-2xl border bg-card p-4 text-foreground shadow-elegant sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Share listing</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                  aria-label="Close share options"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {channels.map((channel) => (
                  <li key={channel.id}>
                    {channel.href ? (
                      <a
                        href={channel.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium hover:bg-secondary"
                        onClick={() => setOpen(false)}
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
                          {channel.icon}
                        </span>
                        {channel.label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void channel.onClick?.()}
                        className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium hover:bg-secondary"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
                          {channel.icon}
                        </span>
                        {channel.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{url}</span>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Share listing"
        className={
          variant === "chip"
            ? "inline-flex h-9 items-center gap-1.5 rounded-full border bg-background/90 px-3 text-xs font-semibold shadow-card backdrop-blur"
            : variant === "card"
              ? "grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md"
              : "grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md"
        }
      >
        {children ?? <Share2 className="h-4 w-4" aria-hidden />}
      </button>
      {sheet}
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2AABEE]" aria-hidden>
      <path
        fill="currentColor"
        d="M9.7 15.3 14.4 21l2.1-12.1L4 11.1l4.2 1.6 1.5 2.6Zm1.6-.5.8-3.7 5.8-4.5-7.5 4.6-.9 3.6Z"
      />
    </svg>
  );
}
