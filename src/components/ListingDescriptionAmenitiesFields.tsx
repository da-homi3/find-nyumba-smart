import { useRef, useState } from "react";
import { Loader2, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { enhanceListingCopy, extractListingAmenities } from "@/lib/api/listing-ai.functions";
import {
  CANONICAL_AMENITIES,
  amenitySelected,
  formatAmenityString,
  mergeAmenities,
  parseAmenityString,
  toggleAmenityInString,
} from "@/lib/listings/amenities";
import { compressImagesForListingAi } from "@/lib/media/compress-for-listing-ai";
import { cn, errorMessage } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

/** Auto-polish + amenity extract once the landlord has a usable draft. */
const MIN_ENHANCE_CHARS = 20;
const SHORT_DESC_FOR_CHIPS = 20;

export type ListingAiDraftContext = {
  title: string;
  property_type: string;
  bedrooms: number | string;
  bathrooms: number | string;
  neighborhood: string;
  latitude: number | string | null;
  longitude: number | string | null;
  rent_kes: number | string;
};

type ListingDescriptionAmenitiesFieldsProps = Readonly<{
  description: string;
  amenities: string;
  onDescriptionChange: (value: string) => void;
  onAmenitiesChange: (value: string) => void;
  draft: ListingAiDraftContext;
  imageFiles?: File[];
  disabled?: boolean;
}>;

export function ListingDescriptionAmenitiesFields({
  description,
  amenities,
  onDescriptionChange,
  onAmenitiesChange,
  draft,
  imageFiles = [],
  disabled = false,
}: ListingDescriptionAmenitiesFieldsProps) {
  const [enhancing, setEnhancing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [undoDescription, setUndoDescription] = useState<string | null>(null);
  const lastEnhancedFor = useRef<string>("");
  const lastExtractedFor = useRef<string>("");
  const amenitiesRef = useRef(amenities);
  amenitiesRef.current = amenities;

  const showChips = description.trim().length < SHORT_DESC_FOR_CHIPS;

  function applyAmenities(nextList: string[], { toastOnFill }: { toastOnFill: boolean }) {
    const current = amenitiesRef.current;
    const next = formatAmenityString(mergeAmenities(parseAmenityString(current), nextList));
    if (next !== current) {
      onAmenitiesChange(next);
      if (toastOnFill && nextList.length > 0) {
        toast.success("Amenities filled from description — edit anytime");
      }
    }
  }

  async function runExtract(source: string, { toastOnFill }: { toastOnFill: boolean }) {
    const trimmed = source.trim();
    if (trimmed.length < 8) return;
    if (lastExtractedFor.current === trimmed) return;
    setExtracting(true);
    try {
      const result = await extractListingAmenities({
        data: {
          description: trimmed,
          existingAmenities: amenitiesRef.current,
        },
      });
      lastExtractedFor.current = trimmed;
      applyAmenities(result.amenities, { toastOnFill });
    } catch (err) {
      toast.error("Could not extract amenities", { description: errorMessage(err) });
    } finally {
      setExtracting(false);
    }
  }

  async function runEnhance(source: string, { force }: { force: boolean }) {
    const trimmed = source.trim();
    if (trimmed.length < MIN_ENHANCE_CHARS) {
      if (force) toast.error(`Add at least ${MIN_ENHANCE_CHARS} characters before enhancing`);
      else if (trimmed.length >= 8) await runExtract(trimmed, { toastOnFill: true });
      return;
    }
    if (!force && lastEnhancedFor.current === trimmed) return;
    setEnhancing(true);
    try {
      const imageDataUrls =
        imageFiles.length > 0 ? await compressImagesForListingAi(imageFiles) : [];
      const result = await enhanceListingCopy({
        data: {
          description: trimmed,
          existingAmenities: amenitiesRef.current,
          draft: {
            title: draft.title,
            property_type: draft.property_type,
            bedrooms: Number(draft.bedrooms) || 0,
            bathrooms: Number(draft.bathrooms) || 0,
            neighborhood: draft.neighborhood,
            latitude: draft.latitude == null ? null : Number(draft.latitude),
            longitude: draft.longitude == null ? null : Number(draft.longitude),
            rent_kes: Number(draft.rent_kes) || 0,
            amenities: amenitiesRef.current,
          },
          imageDataUrls: imageDataUrls.length > 0 ? imageDataUrls : undefined,
        },
      });
      const next = (result.description || "").trim() || trimmed;
      setUndoDescription(trimmed);
      onDescriptionChange(next);
      lastEnhancedFor.current = next;
      lastExtractedFor.current = next;
      applyAmenities(result.amenities ?? [], { toastOnFill: false });
      toast.success("Description analyzed & enhanced — amenities updated");
    } catch (err) {
      toast.error("Could not enhance description", { description: errorMessage(err) });
    } finally {
      setEnhancing(false);
    }
  }

  function handleDescriptionBlur() {
    if (disabled || enhancing) return;
    const trimmed = description.trim();
    if (trimmed.length >= MIN_ENHANCE_CHARS) {
      void runEnhance(trimmed, { force: false });
    } else if (trimmed.length >= 8) {
      void runExtract(trimmed, { toastOnFill: true });
    }
  }

  function handleUndo() {
    if (!undoDescription) return;
    onDescriptionChange(undoDescription);
    lastEnhancedFor.current = "";
    setUndoDescription(null);
  }

  let aiStatus = "AI analyzes the description thoroughly, polishes wording, and fills every amenity found.";
  if (enhancing) aiStatus = "Analyzing description, polishing copy, and extracting amenities…";
  else if (extracting) aiStatus = "Extracting amenities…";

  return (
    <div className="col-span-full space-y-4">
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>Description</span>
          <span className="flex items-center gap-2">
            {undoDescription ? (
              <button
                type="button"
                disabled={disabled || enhancing}
                onClick={handleUndo}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </button>
            ) : null}
            <button
              type="button"
              disabled={disabled || enhancing || description.trim().length < MIN_ENHANCE_CHARS}
              onClick={() => void runEnhance(description, { force: true })}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {enhancing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Enhance with AI
            </button>
          </span>
        </span>
        <textarea
          rows={5}
          value={description}
          disabled={disabled || enhancing}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Describe the unit, building amenities, nearby landmarks, and viewing instructions…"
          className={inputCls}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{aiStatus}</p>
      </label>

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>Amenities (comma separated)</span>
          {description.trim().length >= 8 ? (
            <button
              type="button"
              disabled={disabled || extracting || enhancing}
              onClick={() => {
                lastExtractedFor.current = "";
                void runExtract(description, { toastOnFill: true });
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Suggest from description
            </button>
          ) : null}
        </span>
        <input
          value={amenities}
          disabled={disabled}
          onChange={(e) => onAmenitiesChange(e.target.value)}
          placeholder="WiFi, Borehole, Parking, Gym"
          className={inputCls}
        />
      </label>

      {showChips ? (
        <div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            No description yet — tap amenities that apply:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CANONICAL_AMENITIES.map((label) => {
              const selected = amenitySelected(amenities, label);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAmenitiesChange(toggleAmenityInString(amenities, label))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
