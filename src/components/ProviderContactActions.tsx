import type { ReactNode } from "react";
import { Globe, MessageCircle, Phone } from "lucide-react";
import type { PublicServiceProvider } from "@/lib/api/service-provider.functions";
import { whatsAppUrl } from "@/lib/phone";

type ProviderContactProps = Readonly<{
  provider: Pick<
    PublicServiceProvider,
    "businessName" | "phone" | "phoneVerified" | "websiteUrl" | "category"
  >;
  category?: string;
  size?: "sm" | "md";
}>;

export function ProviderContactDetails({ provider, size = "md" }: Omit<ProviderContactProps, "category">) {
  const textClass = size === "sm" ? "text-xs" : "text-sm";
  const canCall = provider.phoneVerified && provider.phone;

  let contactLine: ReactNode;
  if (canCall) {
    contactLine = (
      <p className={`mt-1.5 flex items-center gap-1.5 font-medium ${textClass}`}>
        <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <a href={`tel:${provider.phone}`} className="hover:text-primary">
          {provider.phone}
        </a>
      </p>
    );
  } else if (provider.websiteUrl) {
    contactLine = (
      <p className={`mt-1.5 flex items-center gap-1.5 font-medium ${textClass}`}>
        <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <a
          href={provider.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary"
        >
          Contact via website
        </a>
      </p>
    );
  } else {
    contactLine = (
      <p className={`mt-1.5 ${textClass} text-muted-foreground`}>
        Request a quote — we&apos;ll connect you with this provider.
      </p>
    );
  }

  return contactLine;
}

export function ProviderContactActions({
  provider,
  category,
  size = "md",
}: ProviderContactProps) {
  const cat = category ?? provider.category;
  const btnClass =
    size === "sm"
      ? "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
      : "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold";
  const canCall = provider.phoneVerified && provider.phone;
  const waLink = canCall
    ? whatsAppUrl(
        provider.phone,
        `Hi ${provider.businessName}, I found you on NyumbaSearch and would like a quote for ${cat}.`,
      )
    : null;

  return (
    <div className="flex flex-wrap gap-2">
      {waLink ? (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnClass} bg-[#25D366] text-white hover:opacity-95`}
        >
          <MessageCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          WhatsApp
        </a>
      ) : null}
      {canCall ? (
        <a
          href={`tel:${provider.phone}`}
          className={`${btnClass} border hover:bg-secondary`}
        >
          <Phone className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          Call
        </a>
      ) : null}
      {!canCall && provider.websiteUrl ? (
        <a
          href={provider.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnClass} border hover:bg-secondary`}
        >
          <Globe className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          Visit website
        </a>
      ) : null}
    </div>
  );
}
