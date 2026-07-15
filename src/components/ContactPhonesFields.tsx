import { Plus, X } from "lucide-react";
import { MAX_CONTACT_PHONES } from "@/lib/contact-phones";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

type Props = Readonly<{
  phones: string[];
  onChange: (phones: string[]) => void;
  required?: boolean;
  className?: string;
}>;

export function ContactPhonesFields({ phones, onChange, required, className }: Props) {
  const rows = phones.length > 0 ? phones : [""];

  function setAt(index: number, value: string) {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  }

  function addRow() {
    if (rows.length >= MAX_CONTACT_PHONES) return;
    onChange([...rows, ""]);
  }

  function removeAt(index: number) {
    if (rows.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((phone, index) => (
        <div key={`contact-phone-${index}`} className="flex gap-2">
          <input
            type="tel"
            required={required && index === 0}
            value={phone}
            onChange={(e) => setAt(index, e.target.value)}
            placeholder={
              index === 0
                ? "e.g. 0712 345 678 or +254712345678"
                : "Another number (optional)"
            }
            className={inputCls}
            aria-label={index === 0 ? "Primary contact phone" : `Contact phone ${index + 1}`}
          />
          {rows.length > 1 ? (
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-muted-foreground hover:bg-muted"
              aria-label={`Remove phone ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      {rows.length < MAX_CONTACT_PHONES ? (
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another number
        </button>
      ) : null}
    </div>
  );
}
