import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Link2, Mail, MessageCircle, Share2, X } from "lucide-react";
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

type ShareVariant = "icon" | "chip" | "card";

type ShareListingButtonProps = Readonly<{
  property: Pick<Property, "id" | "title" | "neighborhood" | "rent_kes">;
  className?: string;
  /** Gallery-style circular control. */
  variant?: ShareVariant;
  children?: ReactNode;
}>;

type Channel = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void | Promise<void>;
  icon: ReactNode;
};

function triggerButtonClass(variant: ShareVariant): string {
  if (variant === "chip") {
    return "inline-flex h-9 items-center gap-1.5 rounded-full border bg-background/90 px-3 text-xs font-semibold shadow-card backdrop-blur";
  }
  if (variant === "card") {
    return "grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md";
  }
  return "grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md";
}

export function ShareListingButton({
  property,
  className,
  variant = "icon",
  children,
}: ShareListingButtonProps) {
  const panelId = useId();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = listingShareUrl(property.id);
  const text = listingShareText(property);
  const title = property.title || "NyumbaSearch listing";

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) dialog.showModal();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open]);

  function closeSheet() {
    setOpen(false);
    dialogRef.current?.close();
  }

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
      closeSheet();
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
      icon: <FacebookIcon />,
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
      icon: <TelegramIcon />,
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

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        aria-label="Share listing"
        className={triggerButtonClass(variant)}
      >
        {children ?? <Share2 className="h-4 w-4" aria-hidden />}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <dialog
              ref={dialogRef}
              id={panelId}
              aria-labelledby={titleId}
              className="z-100 m-0 max-h-none w-full max-w-none border-0 bg-transparent p-0 open:fixed open:inset-0 open:flex open:h-full open:items-end open:justify-center sm:open:items-center backdrop:bg-black/50"
              onClose={() => setOpen(false)}
            >
              <button
                type="button"
                aria-label="Dismiss share sheet"
                className="absolute inset-0 cursor-default bg-transparent"
                onClick={closeSheet}
              />
              <div className="relative z-10 mx-auto w-full max-w-md rounded-t-2xl border bg-card p-4 text-foreground shadow-elegant sm:rounded-2xl">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p id={titleId} className="text-sm font-semibold">
                      Share listing
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeSheet();
                    }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
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
                          onClick={closeSheet}
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
            </dialog>,
            document.body,
          )
        : null}
    </div>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#1877F2]" aria-hidden>
      <path
        fill="currentColor"
        d="M14 8h2V5h-2c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.1l.4-3H13V9c0-.6.4-1 1-1Z"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2AABEE]" aria-hidden>
      <path
        fill="currentColor"
        d="M9.7 15.3 14.4 21l2.1-12.1L4 11.1l4.2 1.6 1.5 2.6Zm1.6-.5.8-3.7 5.8-4.5-7.5 4.6-.9 3.6Z"
      />
    </svg>
  );
}
