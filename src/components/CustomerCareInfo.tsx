import {
  CUSTOMER_CARE_EMAIL,
  CUSTOMER_CARE_PHONE,
  customerCareMailtoHref,
  customerCareTelHref,
} from "@/lib/site";
import { whatsAppUrl } from "@/lib/phone";

type CustomerCareInfoProps = Readonly<{
  className?: string;
  /** Compact single line vs stacked block */
  layout?: "inline" | "stack";
}>;

export function CustomerCareInfo({ className = "", layout = "stack" }: CustomerCareInfoProps) {
  const waUrl = whatsAppUrl(CUSTOMER_CARE_PHONE, "Hi NyumbaSearch, I need help with…");

  if (layout === "inline") {
    return (
      <p className={`text-sm text-muted-foreground ${className}`.trim()}>
        Customer care:{" "}
        <a href={customerCareMailtoHref()} className="text-primary hover:underline">
          {CUSTOMER_CARE_EMAIL}
        </a>
        {" · "}
        <a href={customerCareTelHref()} className="text-primary hover:underline">
          {CUSTOMER_CARE_PHONE}
        </a>
        {waUrl ? (
          <>
            {" · "}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              WhatsApp
            </a>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div className={`rounded-2xl border bg-card p-5 text-sm ${className}`.trim()}>
      <p className="font-semibold text-foreground">Customer care</p>
      <p className="mt-1 text-muted-foreground">Help, assistance, and general inquiries</p>
      <ul className="mt-4 space-y-2">
        <li>
          <span className="text-muted-foreground">Email: </span>
          <a href={customerCareMailtoHref()} className="font-medium text-primary hover:underline">
            {CUSTOMER_CARE_EMAIL}
          </a>
        </li>
        <li>
          <span className="text-muted-foreground">Phone: </span>
          <a href={customerCareTelHref()} className="font-medium text-primary hover:underline">
            {CUSTOMER_CARE_PHONE}
          </a>
        </li>
        {waUrl ? (
          <li>
            <span className="text-muted-foreground">WhatsApp: </span>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Message us
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
