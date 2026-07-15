import { PropertyLocationPicker } from "@/components/PropertyLocationPicker";
import { FileDropZone } from "@/components/FileDropZone";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { KENYA_LOCATION_LABELS } from "@/data/kenya-locations";
import type { PropertyType } from "@/lib/property-types";
import {
  isCommercialType,
  listingPricingNote,
  prettyPropertyType,
  PROPERTY_TYPE_OPTIONS,
} from "@/lib/property-types";
import { formatListingPrice } from "@/lib/commercial-ranges";
import {
  applyPropertyTypePricingDefaults,
  PropertyPricingFields,
} from "@/components/PropertyPricingFields";
import { MAX_IMAGE_UPLOAD_MB, MAX_VIDEO_UPLOAD_MB } from "@/lib/media/upload-limits";
import { cn } from "@/lib/utils";
import { Compass, Film, Image as ImageIcon, Link2, X } from "lucide-react";
import type { ListingFormState, TabId } from "@/components/PropertyListingWizard";

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

type ListingFormUpdater = <K extends keyof ListingFormState>(k: K, v: ListingFormState[K]) => void;

function Field({
  label,
  children,
  full,
}: Readonly<{
  label: React.ReactNode;
  children: React.ReactNode;
  full?: boolean;
}>) {
  return (
    <label className={cn("block", full && "col-span-full")}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ImagePreview({ file, onRemove }: Readonly<{ file: File; onRemove: () => void }>) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border bg-background">
      <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-foreground/80 p-1 text-background opacity-0 transition group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ListingWizardDetailsTab({
  form,
  update,
  requireContactPhone,
}: Readonly<{
  form: ListingFormState;
  update: ListingFormUpdater;
  requireContactPhone?: boolean;
}>) {
  return (
    <div className="space-y-5">
      <Field label="Listing title" full>
        <input
          required
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. Modern 2BR with City Views"
          className={inputCls}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property type">
          <select
            value={form.property_type}
            onChange={(e) => {
              const nextType = e.target.value as PropertyType;
              update("property_type", nextType);
              const defaults = applyPropertyTypePricingDefaults(nextType);
              update("pricing_mode", defaults.pricing_mode);
              update("price_period", defaults.price_period);
              update("minimum_rent_period_months", defaults.minimum_rent_period_months);
              update("rent_kes_max", defaults.rent_kes_max);
              if (!isCommercialType(nextType)) update("area_sqm_max", "");
              if (isCommercialType(nextType) && form.bathrooms < 1) update("bathrooms", 0);
              if (!isCommercialType(nextType) && form.bathrooms < 1) update("bathrooms", 1);
            }}
            className={inputCls}
          >
            {PROPERTY_TYPE_OPTIONS.map((typeOption) => (
              <option key={typeOption.id} value={typeOption.id}>
                {typeOption.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Neighborhood / area">
          <input
            required
            list="kenya-locations"
            value={form.neighborhood}
            onChange={(e) => update("neighborhood", e.target.value)}
            placeholder="e.g. Kilimani or Nyali, Mombasa"
            className={inputCls}
          />
          <datalist id="kenya-locations">
            {KENYA_LOCATION_LABELS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Street address (optional)" full>
        <input
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="Building name, street"
          className={inputCls}
        />
      </Field>
      <Field
        label={requireContactPhone ? "Contact name (required)" : "Contact name (optional)"}
        full
      >
        <input
          required={requireContactPhone}
          value={form.contact_name}
          onChange={(e) => update("contact_name", e.target.value)}
          placeholder="e.g. Jane Wanjiku"
          className={inputCls}
        />
      </Field>
      <Field
        label={
          requireContactPhone
            ? "Contact phone (required)"
            : "Contact phone (optional — used for tenant unlocks)"
        }
        full
      >
        <input
          type="tel"
          required={requireContactPhone}
          value={form.contact_phone}
          onChange={(e) => update("contact_phone", e.target.value)}
          placeholder="e.g. 0712 345 678 or +254712345678"
          className={inputCls}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bedrooms">
          <input
            type="number"
            min={0}
            value={form.bedrooms}
            onChange={(e) => update("bedrooms", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Bathrooms">
          <input
            type="number"
            min={isCommercialType(form.property_type) ? 0 : 1}
            value={form.bathrooms}
            onChange={(e) => update("bathrooms", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      </div>
      {isCommercialType(form.property_type) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Size from (m²)">
            <input
              type="number"
              min={0}
              value={form.area_sqm || ""}
              onChange={(e) => update("area_sqm", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Size to (m², optional)">
            <input
              type="number"
              min={0}
              value={form.area_sqm_max || ""}
              onChange={(e) => update("area_sqm_max", Number(e.target.value))}
              placeholder="Leave blank for a single size"
              className={inputCls}
            />
          </Field>
        </div>
      ) : (
        <Field label="Area (m²)" full>
          <input
            type="number"
            min={0}
            value={form.area_sqm || ""}
            onChange={(e) => update("area_sqm", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      )}
      <Field label="Description" full>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Describe the unit, building amenities, nearby landmarks, and viewing instructions…"
          className={inputCls}
        />
      </Field>
      <Field label="Amenities (comma separated)" full>
        <input
          value={form.amenities}
          onChange={(e) => update("amenities", e.target.value)}
          placeholder="WiFi, Borehole, Parking, Gym"
          className={inputCls}
        />
      </Field>
      <PropertyPricingFields
        form={form}
        update={
          update as (
            key: keyof ListingFormState,
            value: ListingFormState[keyof ListingFormState],
          ) => void
        }
        inputCls={inputCls}
      />
    </div>
  );
}

function ListingWizardMediaTab({
  form,
  update,
  busy,
  imageFiles,
  videoFile,
  tourFile,
  uploadProgress,
  onPickImages,
  onPickVideo,
  onPickTour,
  removeImageAt,
  setVideoFile,
  setTourFile,
}: Readonly<{
  form: ListingFormState;
  update: ListingFormUpdater;
  busy: boolean;
  imageFiles: File[];
  videoFile: File | null;
  tourFile: File | null;
  uploadProgress: number | null;
  onPickImages: (files: File[]) => void;
  onPickVideo: (files: File[]) => void;
  onPickTour: (files: File[]) => void;
  removeImageAt: (index: number) => void;
  setVideoFile: (file: File | null) => void;
  setTourFile: (file: File | null) => void;
}>) {
  return (
    <div className="space-y-5">
      <FileDropZone
        accept="image/*"
        multiple
        disabled={busy}
        title="Drop listing photos"
        hint={`Up to 15 photos · max ${MAX_IMAGE_UPLOAD_MB}MB each`}
        icon={<ImageIcon className="h-8 w-8 text-primary sm:h-9 sm:w-9" />}
        onFiles={onPickImages}
        footnote="Add clear photos of living areas, kitchen, bathroom, and exterior."
      />
      {imageFiles.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {imageFiles.map((f, i) => (
            <ImagePreview
              key={`${f.name}-${f.size}-${f.lastModified}`}
              file={f}
              onRemove={() => removeImageAt(i)}
            />
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <FileDropZone
            accept="video/*"
            disabled={busy}
            title="Drop walkthrough video"
            hint={`max ${MAX_VIDEO_UPLOAD_MB}MB`}
            icon={<Film className="h-8 w-8 text-primary sm:h-9 sm:w-9" />}
            onFiles={onPickVideo}
          />
          {videoFile ? (
            <p className="truncate text-xs text-muted-foreground">
              {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)}MB
              <button
                type="button"
                onClick={() => setVideoFile(null)}
                className="ml-2 text-destructive underline"
              >
                remove
              </button>
            </p>
          ) : null}
          <Field label="Or paste video link (YouTube, etc.)" full>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="url"
                value={form.video_url}
                onChange={(e) => update("video_url", e.target.value)}
                placeholder="https://youtube.com/..."
                className={cn(inputCls, "pl-10")}
                disabled={Boolean(videoFile)}
              />
            </div>
          </Field>
        </div>
        <div className="space-y-3">
          <FileDropZone
            accept="image/*"
            disabled={busy}
            title="Drop 360° image"
            hint={`max ${MAX_IMAGE_UPLOAD_MB}MB`}
            icon={<Compass className="h-8 w-8 text-primary sm:h-9 sm:w-9" />}
            onFiles={onPickTour}
          />
          {tourFile ? (
            <p className="truncate text-xs text-muted-foreground">
              {tourFile.name}
              <button
                type="button"
                onClick={() => setTourFile(null)}
                className="ml-2 text-destructive underline"
              >
                remove
              </button>
            </p>
          ) : null}
          <Field label="Or paste tour link (Matterport, etc.)" full>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="url"
                value={form.tour_url}
                onChange={(e) => update("tour_url", e.target.value)}
                placeholder="https://matterport.com/..."
                className={cn(inputCls, "pl-10")}
                disabled={Boolean(tourFile)}
              />
            </div>
          </Field>
        </div>
      </div>
      {uploadProgress !== null ? (
        <UploadProgressBar value={uploadProgress} label="Uploading media…" />
      ) : null}
    </div>
  );
}

function ListingWizardLocationTab({
  form,
  update,
}: Readonly<{ form: ListingFormState; update: ListingFormUpdater }>) {
  return (
    <PropertyLocationPicker
      latitude={form.latitude}
      longitude={form.longitude}
      neighborhood={form.neighborhood}
      onChange={(lat, lng) => {
        update("latitude", lat);
        update("longitude", lng);
      }}
      onNeighborhoodSelect={(value) => update("neighborhood", value)}
    />
  );
}

function reviewPricingSummary(form: ListingFormState): string {
  const price = formatListingPrice({
    property_type: form.property_type,
    rent_kes: form.rent_kes,
    rent_kes_max: form.rent_kes_max || null,
    pricing_mode: form.pricing_mode,
    price_period: form.price_period || null,
  });
  const parts = [price];
  if (form.deposit_kes) parts.push(`deposit KES ${form.deposit_kes.toLocaleString()}`);
  const note = listingPricingNote({
    property_type: form.property_type,
    pricing_mode: form.pricing_mode,
    price_period: form.price_period || null,
    minimum_rent_period_months: form.minimum_rent_period_months
      ? Number(form.minimum_rent_period_months)
      : null,
  });
  if (note) parts.push(note.replace(/^ · /, ""));
  return parts.join(" · ");
}

function reviewMediaSummary(
  form: ListingFormState,
  imageFiles: File[],
  videoFile: File | null,
  tourFile: File | null,
): string {
  const parts = [`${imageFiles.length} photo(s)`];
  if (videoFile || form.video_url.trim()) parts.push("video");
  if (tourFile || form.tour_url.trim()) parts.push("360° tour");
  return parts.join(" · ");
}

function ListingWizardReviewTab({
  form,
  imageFiles,
  videoFile,
  tourFile,
}: Readonly<{
  form: ListingFormState;
  imageFiles: File[];
  videoFile: File | null;
  tourFile: File | null;
}>) {
  const locationParts = [form.neighborhood];
  if (form.address) locationParts.push(form.address);
  if (typeof form.latitude === "number") {
    locationParts.push(`${form.latitude.toFixed(5)}, ${form.longitude?.toFixed(5)}`);
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="font-semibold">Review before publishing</p>
      <dl className="grid gap-2 rounded-xl bg-secondary/40 p-4">
        <div>
          <dt className="text-xs text-muted-foreground">Title & type</dt>
          <dd className="font-medium">
            {form.title || "Untitled"} · {prettyPropertyType(form.property_type)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Location</dt>
          <dd>{locationParts.join(" · ")}</dd>
        </div>
        {form.contact_name.trim() || form.contact_phone.trim() ? (
          <div>
            <dt className="text-xs text-muted-foreground">Contact</dt>
            <dd>
              {[form.contact_name.trim(), form.contact_phone.trim()].filter(Boolean).join(" · ")}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-muted-foreground">Pricing</dt>
          <dd>{reviewPricingSummary(form)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Media</dt>
          <dd>{reviewMediaSummary(form, imageFiles, videoFile, tourFile)}</dd>
        </div>
        {form.description ? (
          <div>
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="line-clamp-3 text-muted-foreground">{form.description}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-xs text-muted-foreground">
        After publishing, NyumbaSearch scores water reliability and trust for this neighborhood.
      </p>
    </div>
  );
}

export type ListingWizardTabContentProps = Readonly<{
  activeTab: TabId;
  form: ListingFormState;
  update: ListingFormUpdater;
  busy: boolean;
  requireContactPhone?: boolean;
  imageFiles: File[];
  videoFile: File | null;
  tourFile: File | null;
  uploadProgress: number | null;
  onPickImages: (files: File[]) => void;
  onPickVideo: (files: File[]) => void;
  onPickTour: (files: File[]) => void;
  removeImageAt: (index: number) => void;
  setVideoFile: (file: File | null) => void;
  setTourFile: (file: File | null) => void;
}>;

export function ListingWizardTabContent({
  activeTab,
  form,
  update,
  busy,
  requireContactPhone,
  imageFiles,
  videoFile,
  tourFile,
  uploadProgress,
  onPickImages,
  onPickVideo,
  onPickTour,
  removeImageAt,
  setVideoFile,
  setTourFile,
}: ListingWizardTabContentProps) {
  switch (activeTab) {
    case "details":
      return (
        <ListingWizardDetailsTab
          form={form}
          update={update}
          requireContactPhone={requireContactPhone}
        />
      );
    case "media":
      return (
        <ListingWizardMediaTab
          form={form}
          update={update}
          busy={busy}
          imageFiles={imageFiles}
          videoFile={videoFile}
          tourFile={tourFile}
          uploadProgress={uploadProgress}
          onPickImages={onPickImages}
          onPickVideo={onPickVideo}
          onPickTour={onPickTour}
          removeImageAt={removeImageAt}
          setVideoFile={setVideoFile}
          setTourFile={setTourFile}
        />
      );
    case "location":
      return <ListingWizardLocationTab form={form} update={update} />;
    case "review":
      return (
        <ListingWizardReviewTab
          form={form}
          imageFiles={imageFiles}
          videoFile={videoFile}
          tourFile={tourFile}
        />
      );
  }
}
