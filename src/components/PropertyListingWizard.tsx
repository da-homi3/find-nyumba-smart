import { useNavigate } from "@tanstack/react-router";
import { createProperty } from "@/lib/api/nyumba.functions";
import { analyzePropertyQuality, createSignedMediaUrls } from "@/lib/api/media.functions";
import { PropertyLocationPicker } from "@/components/PropertyLocationPicker";
import { NAIROBI_NEIGHBORHOODS } from "@/data/nairobi-neighborhoods";
import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { errorMessage, cn } from "@/lib/utils";
import type { PropertyType } from "@/lib/property-types";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import { useAuth } from "@/hooks/use-auth";
import { uploadStorageObjectWithProgress } from "@/lib/media/storage-upload";
import { FileDropZone } from "@/components/FileDropZone";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import {
  Image as ImageIcon,
  Film,
  Compass,
  Loader2,
  X,
  FileText,
  MapPin,
  CheckCircle2,
  Link2,
} from "lucide-react";
import {
  isWithinUploadLimit,
  MAX_IMAGE_UPLOAD_MB,
  MAX_VIDEO_UPLOAD_MB,
  uploadLimitLabel,
} from "@/lib/media/upload-limits";

const TABS = [
  { id: "details", label: "Details", icon: FileText },
  { id: "media", label: "Photos & media", icon: ImageIcon },
  { id: "location", label: "Map pin", icon: MapPin },
  { id: "review", label: "Review", icon: CheckCircle2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

function propertiesListPath(isAgency: boolean, isManager: boolean) {
  if (isAgency) return "/agency/properties";
  if (isManager) return "/manager/properties";
  return "/landlord/properties";
}

async function uploadToStorage(
  path: string,
  file: File,
  onFileProgress?: (percent: number) => void,
) {
  await uploadStorageObjectWithProgress("property-media", path, file, onFileProgress);
}

type UploadListingMediaInput = {
  userId: string;
  propertyKey: string;
  imageFiles: File[];
  videoFile: File | null;
  tourFile: File | null;
  externalVideoUrl: string;
  externalTourUrl: string;
  onProgress?: (percent: number) => void;
};

function buildMediaUploads(
  userId: string,
  propertyKey: string,
  imageFiles: File[],
  videoFile: File | null,
  tourFile: File | null,
) {
  const uploads: Array<{ path: string; file: File }> = [];
  const uploadedImagePaths: string[] = [];

  for (const file of imageFiles) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${propertyKey}/img-${crypto.randomUUID()}.${ext}`;
    uploads.push({ path, file });
    uploadedImagePaths.push(path);
  }

  let videoPath: string | null = null;
  if (videoFile) {
    const ext = videoFile.name.split(".").pop() ?? "mp4";
    videoPath = `${userId}/${propertyKey}/video-${crypto.randomUUID()}.${ext}`;
    uploads.push({ path: videoPath, file: videoFile });
  }

  let tourPath: string | null = null;
  if (tourFile) {
    const ext = tourFile.name.split(".").pop() ?? "jpg";
    tourPath = `${userId}/${propertyKey}/tour360-${crypto.randomUUID()}.${ext}`;
    uploads.push({ path: tourPath, file: tourFile });
  }

  return { uploads, uploadedImagePaths, videoPath, tourPath };
}

async function runMediaUploads(
  uploads: Array<{ path: string; file: File }>,
  onProgress?: (percent: number) => void,
) {
  const totalBytes = uploads.reduce((sum, item) => sum + item.file.size, 0) || 1;
  let completedBytes = 0;

  for (const item of uploads) {
    await uploadToStorage(item.path, item.file, (filePercent) => {
      if (!onProgress) return;
      const loaded = (filePercent / 100) * item.file.size;
      onProgress(Math.min(100, Math.round(((completedBytes + loaded) / totalBytes) * 100)));
    });
    completedBytes += item.file.size;
    onProgress?.(Math.min(100, Math.round((completedBytes / totalBytes) * 100)));
  }
}

async function uploadListingMedia(input: UploadListingMediaInput) {
  const {
    userId,
    propertyKey,
    imageFiles,
    videoFile,
    tourFile,
    externalVideoUrl,
    externalTourUrl,
    onProgress,
  } = input;

  const { uploads, uploadedImagePaths, videoPath, tourPath } = buildMediaUploads(
    userId,
    propertyKey,
    imageFiles,
    videoFile,
    tourFile,
  );

  await runMediaUploads(uploads, onProgress);

  const allPaths = [
    ...uploadedImagePaths,
    ...(videoPath ? [videoPath] : []),
    ...(tourPath ? [tourPath] : []),
  ];

  let video_url: string | null = externalVideoUrl.trim() || null;
  let tour_url: string | null = externalTourUrl.trim() || null;
  let images: string[] = [];

  if (allPaths.length > 0) {
    const signed = await createSignedMediaUrls({ data: { paths: allPaths } });
    const signedMap = new Map<string, string>();
    for (const entry of signed) {
      if (entry.path && entry.signedUrl) signedMap.set(entry.path, entry.signedUrl);
    }
    images = uploadedImagePaths.map((p) => signedMap.get(p)).filter(Boolean) as string[];
    if (videoPath) video_url = signedMap.get(videoPath) ?? video_url;
    if (tourPath) tour_url = signedMap.get(tourPath) ?? tour_url;
  }

  return { images, video_url, tour_url };
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

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function PropertyListingWizard({
  portalLabel = "Landlord",
}: Readonly<{ portalLabel?: string }>) {
  const navigate = useNavigate();
  const { user, isAgency, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [tourFile, setTourFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    property_type: "one_bedroom" as PropertyType,
    neighborhood: "",
    address: "",
    rent_kes: 0,
    deposit_kes: 0,
    bedrooms: 1,
    bathrooms: 1,
    area_sqm: 0,
    description: "",
    amenities: "",
    video_url: "",
    tour_url: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onPickImages(files: File[]) {
    const valid = files.filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: not an image`);
        return false;
      }
      if (!isWithinUploadLimit(f, "image")) {
        toast.error(`${f.name}: max ${uploadLimitLabel("image")}`);
        return false;
      }
      return true;
    });
    setImageFiles((prev) => [...prev, ...valid].slice(0, 15));
  }

  function onPickVideo(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Please choose a video file");
      return;
    }
    if (!isWithinUploadLimit(f, "video")) {
      toast.error(`Video must be under ${uploadLimitLabel("video")}`);
      return;
    }
    setVideoFile(f);
  }

  function onPickTour(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("360° tour upload must be an equirectangular image");
      return;
    }
    if (!isWithinUploadLimit(f, "tour")) {
      toast.error(`360° image must be under ${uploadLimitLabel("tour")}`);
      return;
    }
    setTourFile(f);
  }

  function removeImageAt(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function validateTab(tab: TabId): boolean {
    if (tab === "details") {
      if (!form.title.trim() || !form.neighborhood.trim()) {
        toast.error("Title and neighborhood are required");
        return false;
      }
      if (form.rent_kes <= 0) {
        toast.error("Enter a valid monthly rent");
        return false;
      }
    }
    if (tab === "media" && imageFiles.length === 0) {
      toast.error("Add at least one photo");
      return false;
    }
    if (tab === "location" && (form.latitude == null || form.longitude == null)) {
      toast.error("Pin the property on the map");
      return false;
    }
    return true;
  }

  function switchTab(tab: TabId) {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    const targetIndex = TABS.findIndex((t) => t.id === tab);
    if (targetIndex > currentIndex) {
      for (let i = currentIndex; i < targetIndex; i++) {
        if (!validateTab(TABS[i].id)) return;
      }
    }
    setActiveTab(tab);
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateTab("details") || !validateTab("media") || !validateTab("location")) return;
    if (!user) {
      toast.error("Sign in to list a property");
      return;
    }

    setLoading(true);
    try {
      const propertyKey = crypto.randomUUID();
      setUploading(true);
      setUploadProgress(0);
      const media = await uploadListingMedia({
        userId: user.id,
        propertyKey,
        imageFiles,
        videoFile,
        tourFile,
        externalVideoUrl: form.video_url,
        externalTourUrl: form.tour_url,
        onProgress: setUploadProgress,
      });
      setUploading(false);
      setUploadProgress(null);

      const created = await createProperty({
        data: {
          title: form.title,
          property_type: form.property_type,
          neighborhood: form.neighborhood,
          address: form.address || null,
          latitude: form.latitude,
          longitude: form.longitude,
          rent_kes: Number(form.rent_kes),
          deposit_kes: Number(form.deposit_kes) || null,
          bedrooms: Number(form.bedrooms),
          bathrooms: Number(form.bathrooms),
          area_sqm: Number(form.area_sqm) || null,
          description: form.description || null,
          amenities: form.amenities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          images: media.images,
          video_url: media.video_url,
          tour_url: media.tour_url,
          is_active: true,
        },
      });

      toast.success(
        `Property listed! Area stats: health ${created.health_score ?? "—"} · authenticity ${created.authenticity_score ?? "—"}`,
      );
      try {
        const report = await analyzePropertyQuality({ data: { propertyId: created.id } });
        toast.success(`Listing quality: ${report.grade} (${report.score}/100)`, {
          description: report.summary,
          duration: 8000,
        });
      } catch (err) {
        toast.warning("Quality analysis failed", { description: errorMessage(err) });
      }

      navigate({ to: propertiesListPath(isAgency, isManager) });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
      setUploading(false);
      setUploadProgress(null);
    }
  }

  const busy = loading || uploading;
  const tabIndex = TABS.findIndex((t) => t.id === activeTab);
  const isLastTab = activeTab === "review";

  function submitLabel(): string {
    if (!isLastTab) return "Continue";
    if (uploading && uploadProgress !== null) return `Uploading media… ${uploadProgress}%`;
    if (uploading) return "Uploading media…";
    if (loading) return "Publishing…";
    return "Publish listing";
  }

  function goNext(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateTab(activeTab)) return;
    if (isLastTab) return;
    setActiveTab(TABS[tabIndex + 1].id);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Add a property</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {portalLabel} portal — add details, upload media, and pin the exact location on the map.
      </p>

      <div
        className="mt-6 flex gap-1 overflow-x-auto border-b pb-px"
        role="tablist"
        aria-label="Listing sections"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition",
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={isLastTab ? onSubmit : goNext}
        className="mt-6 space-y-5 rounded-2xl border bg-card p-6 shadow-soft"
      >
        {activeTab === "details" && (
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
                  onChange={(e) => update("property_type", e.target.value as PropertyType)}
                  className={inputCls}
                >
                  {PROPERTY_TYPE_OPTIONS.map((typeOption) => (
                    <option key={typeOption.id} value={typeOption.id}>
                      {typeOption.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Neighborhood">
                <input
                  required
                  list="nairobi-neighborhoods"
                  value={form.neighborhood}
                  onChange={(e) => update("neighborhood", e.target.value)}
                  placeholder="e.g. Tumaini, Rongai"
                  className={inputCls}
                />
                <datalist id="nairobi-neighborhoods">
                  {NAIROBI_NEIGHBORHOODS.map((n) => (
                    <option key={n} value={n} />
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

            <div className="grid gap-4 sm:grid-cols-3">
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
                  min={1}
                  value={form.bathrooms}
                  onChange={(e) => update("bathrooms", Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Area (m²)">
                <input
                  type="number"
                  min={0}
                  value={form.area_sqm || ""}
                  onChange={(e) => update("area_sqm", Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>

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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rent (KES/month)">
                <input
                  required
                  type="number"
                  min={1}
                  value={form.rent_kes || ""}
                  onChange={(e) => update("rent_kes", Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Deposit (KES)">
                <input
                  type="number"
                  min={0}
                  value={form.deposit_kes || ""}
                  onChange={(e) => update("deposit_kes", Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        )}

        {activeTab === "media" && (
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
        )}

        {activeTab === "location" && (
          <PropertyLocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            neighborhood={form.neighborhood}
            onChange={(lat, lng) => {
              update("latitude", lat);
              update("longitude", lng);
            }}
          />
        )}

        {activeTab === "review" && (
          <div className="space-y-4 text-sm">
            <p className="font-semibold">Review before publishing</p>
            <dl className="grid gap-2 rounded-xl bg-secondary/40 p-4">
              <div>
                <dt className="text-xs text-muted-foreground">Title & type</dt>
                <dd className="font-medium">
                  {form.title || "Untitled"} · {form.property_type.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd>
                  {form.neighborhood}
                  {form.address ? ` · ${form.address}` : ""}
                  {typeof form.latitude === "number" &&
                    ` · ${form.latitude.toFixed(5)}, ${form.longitude?.toFixed(5)}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Pricing</dt>
                <dd>
                  KES {form.rent_kes.toLocaleString()}/mo
                  {form.deposit_kes ? ` · deposit KES ${form.deposit_kes.toLocaleString()}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Media</dt>
                <dd>
                  {imageFiles.length} photo(s)
                  {videoFile || form.video_url.trim() ? " · video" : ""}
                  {tourFile || form.tour_url.trim() ? " · 360° tour" : ""}
                </dd>
              </div>
              {form.description ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Description</dt>
                  <dd className="line-clamp-3 text-muted-foreground">{form.description}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs text-muted-foreground">
              After publishing, NyumbaSearch scores water reliability and trust for this
              neighborhood.
            </p>
          </div>
        )}

        <div className="flex gap-2 border-t pt-4">
          {tabIndex > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab(TABS[tabIndex - 1].id)}
              className="flex-1 rounded-xl border py-3 text-sm font-semibold"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel()}
          </button>
        </div>
      </form>
    </div>
  );
}

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
