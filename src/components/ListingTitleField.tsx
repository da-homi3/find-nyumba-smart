import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  generateListingTitle,
  isGeneratedListingTitle,
  type ListingTitleDetails,
} from "@/lib/listings/generate-listing-title";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  details: ListingTitleDetails;
  /** When true, keep regenerating while details change until the user edits. */
  autoGenerate?: boolean;
  inputClassName?: string;
  required?: boolean;
  placeholder?: string;
};

export function ListingTitleField({
  value,
  onChange,
  details,
  autoGenerate = true,
  inputClassName,
  required = true,
  placeholder = "Auto-generated from property details",
}: Readonly<Props>) {
  const [manual, setManual] = useState(() => {
    if (!autoGenerate) return true;
    if (!value.trim()) return false;
    return !isGeneratedListingTitle(value, details);
  });
  const lastAutoRef = useRef("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const type = details.property_type;
  const neighborhood = details.neighborhood;
  const bedrooms = details.bedrooms;
  const bathrooms = details.bathrooms;
  const address = details.address;
  const amenities = details.amenities;
  const areaSqm = details.area_sqm;
  const pricingMode = details.pricing_mode;

  useEffect(() => {
    if (!autoGenerate || manual) return;
    const next = generateListingTitle({
      property_type: type,
      neighborhood,
      bedrooms,
      bathrooms,
      address,
      amenities,
      area_sqm: areaSqm,
      pricing_mode: pricingMode,
    });
    if (!next || next === lastAutoRef.current) return;
    lastAutoRef.current = next;
    onChangeRef.current(next);
  }, [
    autoGenerate,
    manual,
    type,
    neighborhood,
    bedrooms,
    bathrooms,
    address,
    amenities,
    areaSqm,
    pricingMode,
  ]);

  function regenerate() {
    const next = generateListingTitle(details);
    if (!next) return;
    lastAutoRef.current = next;
    setManual(false);
    onChange(next);
  }

  const canGenerate = Boolean(neighborhood.trim());

  let helperText = "Add a neighborhood to auto-generate a unique title.";
  if (manual) {
    helperText = "Custom title — regenerate anytime from type, area, and address.";
  } else if (canGenerate) {
    helperText = "Auto-updating from property details. Edit to lock a custom title.";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Listing title</span>
        <button
          type="button"
          onClick={regenerate}
          disabled={!canGenerate}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" />
          {value.trim() ? "Regenerate from details" : "Generate from details"}
        </button>
      </div>
      <input
        required={required}
        value={value}
        onChange={(e) => {
          setManual(true);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={cn(inputClassName)}
        autoComplete="off"
      />
      <p className="text-[11px] text-muted-foreground">{helperText}</p>
    </div>
  );
}
