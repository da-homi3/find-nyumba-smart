import { useId, useRef } from "react";
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
  /** Frequent numbers shown as clickable chips + datalist autocomplete. */
  suggestions?: string[];
  listId?: string;
}>;

export function ContactPhonesFields({
  phones,
  onChange,
  required,
  className,
  suggestions = [],
  listId: listIdProp,
}: Props) {
  const autoListId = useId();
  const listId = listIdProp ?? autoListId;
  const rows = phones.length > 0 ? phones : [""];
  // Stable keys so typing a digit doesn't remount the input (and lose focus).
  const rowKeysRef = useRef<string[]>([]);
  const nextKeyRef = useRef(0);
  while (rowKeysRef.current.length < rows.length) {
    nextKeyRef.current += 1;
    rowKeysRef.current.push(`phone-row-${nextKeyRef.current}`);
  }
  if (rowKeysRef.current.length > rows.length) {
    rowKeysRef.current = rowKeysRef.current.slice(0, rows.length);
  }

  const unusedSuggestions = suggestions.filter((s) => {
    const key = s.replaceAll(/\s+/g, "");
    return !rows.some((r) => r.replaceAll(/\s+/g, "") === key);
  });

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
    rowKeysRef.current = rowKeysRef.current.filter((_, i) => i !== index);
    if (rows.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  }

  function applySuggestion(phone: string) {
    const emptyIdx = rows.findIndex((r) => !r.trim());
    if (emptyIdx >= 0) {
      setAt(emptyIdx, phone);
      return;
    }
    if (rows.length < MAX_CONTACT_PHONES) {
      onChange([...rows, phone]);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {unusedSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {unusedSuggestions.slice(0, 8).map((phone) => (
            <button
              key={phone}
              type="button"
              onClick={() => applySuggestion(phone)}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              {phone}
            </button>
          ))}
        </div>
      ) : null}
      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((phone) => (
            <option key={phone} value={phone} />
          ))}
        </datalist>
      ) : null}
      {rows.map((phone, index) => (
        <div key={rowKeysRef.current[index]} className="flex gap-2">
          <input
            type="tel"
            required={required && index === 0}
            value={phone}
            list={suggestions.length > 0 ? listId : undefined}
            onChange={(e) => setAt(index, e.target.value)}
            placeholder={
              index === 0 ? "e.g. 0712 345 678 or +254712345678" : "Another number (optional)"
            }
            className={inputCls}
            autoComplete="tel"
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
