import { useNavigate } from "@tanstack/react-router";
import {
  createAdminProperty,
  createProperty,
  createPropertyOnBehalf,
} from "@/lib/api/nyumba.functions";
import {
  analyzePropertyQuality,
  createAdminListingMediaUploadUrls,
  createSignedMediaUrls,
} from "@/lib/api/media.functions";
import { ListingWizardTabContent } from "@/components/PropertyListingWizardTabs";
import { useCallback, useRef, useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { errorMessage, cn } from "@/lib/utils";
import type { PropertyType, PricingMode, PricePeriod } from "@/lib/property-types";
import {
  defaultPricePeriod,
  defaultPricingMode,
  isCommercialType,
  isNightlyRentType,
  listingPriceAmountLabel,
} from "@/lib/property-types";
import { validateCommercialRanges } from "@/lib/commercial-ranges";
import { enhanceImageForUpload, enhanceVideoForUpload } from "@/lib/media/enhance-upload";
import { useAuth } from "@/hooks/use-auth";
import {
  uploadStorageObjectViaSignedUrl,
  uploadStorageObjectWithProgress,
} from "@/lib/media/storage-upload";
import {
  fileUploadIdentity,
  getListingUploadSnapshot,
  runDurableListingUpload,
  type DurableUploadController,
} from "@/lib/media/listing-upload-session";
import { useKeepListingUploadAlive } from "@/lib/media/use-keep-listing-upload-alive";
import { Loader2, FileText, MapPin, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { portalLabelForRole } from "@/lib/portal-labels";
import { isWithinUploadLimit, uploadLimitLabel } from "@/lib/media/upload-limits";
import { randomUuid } from "@/lib/random-uuid";
import { contactPhoneFields } from "@/lib/contact-phones";

const TABS = [
  { id: "details", label: "Details", icon: FileText },
  { id: "media", label: "Photos & media", icon: ImageIcon },
  { id: "location", label: "Map pin", icon: MapPin },
  { id: "review", label: "Review", icon: CheckCircle2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export type { TabId };

function propertiesListPath(isAgency: boolean, isManager: boolean) {
  if (isAgency) return "/agency/properties";
  if (isManager) return "/manager/properties";
  return "/landlord/properties";
}

async function uploadToStorage(
  path: string,
  file: File,
  onFileProgress?: (percent: number) => void,
  upsert = false,
) {
  await uploadStorageObjectWithProgress("property-media", path, file, onFileProgress, { upsert });
}

type UploadListingMediaInput = {
  userId: string;
  propertyKey: string;
  imageFiles: File[];
  videoFile: File | null;
  tourFile: File | null;
  externalVideoUrl: string;
  externalTourUrl: string;
  adminOnBehalf?: boolean;
  onProgress?: (percent: number) => void;
  controller?: DurableUploadController;
};

function buildMediaUploads(input: {
  userId: string;
  propertyKey: string;
  imageFiles: File[];
  imageSourceIds: string[];
  videoFile: File | null;
  videoSourceId: string | null;
  tourFile: File | null;
  tourSourceId: string | null;
  controller?: DurableUploadController;
}) {
  const {
    userId,
    propertyKey,
    imageFiles,
    imageSourceIds,
    videoFile,
    videoSourceId,
    tourFile,
    tourSourceId,
    controller,
  } = input;
  const uploads: Array<{ path: string; file: File }> = [];
  const uploadedImagePaths: string[] = [];
  const resolvePath =
    controller?.resolvePath ?? ((_fileId: string, buildPath: () => string) => buildPath());

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i]!;
    const ext = file.name.split(".").pop() ?? "jpg";
    const fileId = `img:${imageSourceIds[i] ?? fileUploadIdentity(file)}`;
    const path = resolvePath(fileId, () => `${userId}/${propertyKey}/img-${randomUuid()}.${ext}`);
    uploads.push({ path, file });
    uploadedImagePaths.push(path);
  }

  let videoPath: string | null = null;
  if (videoFile) {
    const ext = videoFile.name.split(".").pop() ?? "mp4";
    const fileId = `video:${videoSourceId ?? fileUploadIdentity(videoFile)}`;
    videoPath = resolvePath(fileId, () => `${userId}/${propertyKey}/video-${randomUuid()}.${ext}`);
    uploads.push({ path: videoPath, file: videoFile });
  }

  let tourPath: string | null = null;
  if (tourFile) {
    const ext = tourFile.name.split(".").pop() ?? "jpg";
    const fileId = `tour:${tourSourceId ?? fileUploadIdentity(tourFile)}`;
    tourPath = resolvePath(fileId, () => `${userId}/${propertyKey}/tour360-${randomUuid()}.${ext}`);
    uploads.push({ path: tourPath, file: tourFile });
  }

  return { uploads, uploadedImagePaths, videoPath, tourPath };
}

async function runMediaUploads(
  uploads: Array<{ path: string; file: File }>,
  onProgress?: (percent: number) => void,
  controller?: DurableUploadController,
) {
  const pending = uploads.filter((item) => !controller?.completedPaths.has(item.path));
  const alreadyDoneBytes = uploads
    .filter((item) => controller?.completedPaths.has(item.path))
    .reduce((sum, item) => sum + item.file.size, 0);
  const totalBytes = uploads.reduce((sum, item) => sum + item.file.size, 0) || 1;
  let completedBytes = alreadyDoneBytes;
  if (alreadyDoneBytes > 0) {
    onProgress?.(Math.min(100, Math.round((completedBytes / totalBytes) * 100)));
  }

  for (const item of pending) {
    await uploadToStorage(
      item.path,
      item.file,
      (filePercent) => {
        if (!onProgress) return;
        const loaded = (filePercent / 100) * item.file.size;
        onProgress(Math.min(100, Math.round(((completedBytes + loaded) / totalBytes) * 100)));
      },
      Boolean(controller),
    );
    controller?.markPathDone(item.path);
    completedBytes += item.file.size;
    onProgress?.(Math.min(100, Math.round((completedBytes / totalBytes) * 100)));
  }
}

async function runAdminMediaUploads(
  ownerUserId: string,
  uploads: Array<{ path: string; file: File }>,
  onProgress?: (percent: number) => void,
  controller?: DurableUploadController,
) {
  const pending = uploads.filter((item) => !controller?.completedPaths.has(item.path));
  if (pending.length === 0) {
    onProgress?.(100);
    return;
  }

  const signed = await createAdminListingMediaUploadUrls({
    data: { ownerUserId, paths: pending.map((item) => item.path) },
  });
  const signedByPath = new Map(signed.map((entry) => [entry.path, entry]));

  const alreadyDoneBytes = uploads
    .filter((item) => controller?.completedPaths.has(item.path))
    .reduce((sum, item) => sum + item.file.size, 0);
  const totalBytes = uploads.reduce((sum, item) => sum + item.file.size, 0) || 1;
  let completedBytes = alreadyDoneBytes;
  if (alreadyDoneBytes > 0) {
    onProgress?.(Math.min(100, Math.round((completedBytes / totalBytes) * 100)));
  }

  for (const item of pending) {
    const entry = signedByPath.get(item.path);
    if (!entry) throw new Error("Missing signed upload URL for media");
    await uploadStorageObjectViaSignedUrl(
      entry.signedUrl,
      entry.token,
      item.file,
      (filePercent) => {
        if (!onProgress) return;
        const loaded = (filePercent / 100) * item.file.size;
        onProgress(Math.min(100, Math.round(((completedBytes + loaded) / totalBytes) * 100)));
      },
      { upsert: true },
    );
    controller?.markPathDone(item.path);
    completedBytes += item.file.size;
    onProgress?.(Math.min(100, Math.round((completedBytes / totalBytes) * 100)));
  }
}

async function prepareEnhancedMediaFiles(
  imageFiles: File[],
  videoFile: File | null,
  tourFile: File | null,
) {
  const [enhancedImages, enhancedVideo, enhancedTour] = await Promise.all([
    Promise.all(imageFiles.map((file) => enhanceImageForUpload(file))),
    videoFile ? enhanceVideoForUpload(videoFile) : Promise.resolve(null),
    tourFile ? enhanceImageForUpload(tourFile) : Promise.resolve(null),
  ]);
  return { enhancedImages, enhancedVideo, enhancedTour };
}

async function signUploadedMediaPaths(
  uploadedImagePaths: string[],
  videoPath: string | null,
  tourPath: string | null,
  externalVideoUrl: string,
  externalTourUrl: string,
) {
  const allPaths = [
    ...uploadedImagePaths,
    ...(videoPath ? [videoPath] : []),
    ...(tourPath ? [tourPath] : []),
  ];

  let video_url: string | null = externalVideoUrl.trim() || null;
  let tour_url: string | null = externalTourUrl.trim() || null;
  let images: string[] = [];

  if (allPaths.length === 0) {
    return { images, video_url, tour_url };
  }

  const signed = await createSignedMediaUrls({ data: { paths: allPaths } });
  const signedMap = new Map<string, string>();
  for (const entry of signed) {
    if (entry.path && entry.signedUrl) signedMap.set(entry.path, entry.signedUrl);
  }

  images = uploadedImagePaths.map((p) => signedMap.get(p)).filter(Boolean) as string[];
  if (videoPath) video_url = signedMap.get(videoPath) ?? video_url;
  if (tourPath) tour_url = signedMap.get(tourPath) ?? tour_url;

  return { images, video_url, tour_url };
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
    adminOnBehalf,
    onProgress,
    controller,
  } = input;

  controller?.setPhase("enhancing");
  const imageSourceIds = imageFiles.map((file) => fileUploadIdentity(file));
  const videoSourceId = videoFile ? fileUploadIdentity(videoFile) : null;
  const tourSourceId = tourFile ? fileUploadIdentity(tourFile) : null;

  const { enhancedImages, enhancedVideo, enhancedTour } = await prepareEnhancedMediaFiles(
    imageFiles,
    videoFile,
    tourFile,
  );

  const { uploads, uploadedImagePaths, videoPath, tourPath } = buildMediaUploads({
    userId,
    propertyKey,
    imageFiles: enhancedImages,
    imageSourceIds,
    videoFile: enhancedVideo,
    videoSourceId,
    tourFile: enhancedTour,
    tourSourceId,
    controller,
  });

  controller?.setPhase("uploading");
  if (adminOnBehalf) {
    await runAdminMediaUploads(userId, uploads, onProgress, controller);
  } else {
    await runMediaUploads(uploads, onProgress, controller);
  }

  return signUploadedMediaPaths(
    uploadedImagePaths,
    videoPath,
    tourPath,
    externalVideoUrl,
    externalTourUrl,
  );
}

export type ListingOnBehalfTarget = {
  userId: string;
  displayName: string;
  portalRole: "landlord" | "agency" | "manager";
};

export type ListingFormState = {
  title: string;
  property_type: PropertyType;
  neighborhood: string;
  address: string;
  contact_phones: string[];
  contact_name: string;
  rent_kes: number;
  rent_kes_max: number | "";
  deposit_kes: number;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  area_sqm_max: number | "";
  description: string;
  amenities: string;
  video_url: string;
  tour_url: string;
  minimum_rent_period_months: number | "";
  pricing_mode: PricingMode;
  price_period: PricePeriod | "";
  latitude: number | null;
  longitude: number | null;
};

function validateListingDetailsTab(form: ListingFormState, requireContactPhone: boolean): boolean {
  if (!form.title.trim() || !form.neighborhood.trim()) {
    toast.error("Title and neighborhood are required");
    return false;
  }
  const phones = contactPhoneFields(form.contact_phones).contact_phones;
  if (requireContactPhone && phones.length === 0) {
    toast.error("Add at least one contact phone tenants can unlock");
    return false;
  }
  if (form.contact_phones.some((p) => p.trim() && p.trim().length < 9)) {
    toast.error("Each contact phone needs at least 9 digits");
    return false;
  }
  if (requireContactPhone && form.contact_name.trim().length < 2) {
    toast.error("Add the contact person's name");
    return false;
  }
  if (form.rent_kes <= 0) {
    toast.error(
      `Enter a valid ${listingPriceAmountLabel({
        property_type: form.property_type,
        pricing_mode: form.pricing_mode,
        price_period: form.price_period || null,
      }).toLowerCase()}`,
    );
    return false;
  }
  if (
    isCommercialType(form.property_type) &&
    form.pricing_mode === "rent" &&
    !form.minimum_rent_period_months
  ) {
    toast.error("Select a minimum rent period for commercial lease listings");
    return false;
  }
  if (
    (isNightlyRentType(form.property_type) || form.pricing_mode === "booking") &&
    !form.price_period
  ) {
    toast.error("Select a booking period");
    return false;
  }
  if (!isCommercialType(form.property_type)) return true;

  let rangeError: string | null = null;
  validateCommercialRanges(
    {
      property_type: form.property_type,
      rent_kes: form.rent_kes,
      rent_kes_max: form.rent_kes_max ? Number(form.rent_kes_max) : null,
      area_sqm: form.area_sqm || null,
      area_sqm_max: form.area_sqm_max ? Number(form.area_sqm_max) : null,
    },
    (_path, message) => {
      rangeError = message;
    },
  );
  if (rangeError) {
    toast.error(rangeError);
    return false;
  }
  return true;
}

function validateListingTab(
  tab: TabId,
  form: ListingFormState,
  imageCount: number,
  requireContactPhone: boolean,
): boolean {
  if (tab === "details") return validateListingDetailsTab(form, requireContactPhone);
  if (tab === "media" && imageCount === 0) {
    toast.error("Add at least one photo");
    return false;
  }
  if (tab === "location" && (form.latitude == null || form.longitude == null)) {
    toast.error("Pin the property on the map");
    return false;
  }
  return true;
}

function buildListingPayload(
  form: ListingFormState,
  media: Awaited<ReturnType<typeof uploadListingMedia>>,
) {
  return {
    title: form.title,
    property_type: form.property_type,
    neighborhood: form.neighborhood,
    address: form.address || null,
    latitude: form.latitude,
    longitude: form.longitude,
    rent_kes: Number(form.rent_kes),
    rent_kes_max:
      isCommercialType(form.property_type) && form.rent_kes_max ? Number(form.rent_kes_max) : null,
    deposit_kes: Number(form.deposit_kes) || null,
    bedrooms: Number(form.bedrooms),
    bathrooms: Number(form.bathrooms),
    area_sqm: Number(form.area_sqm) || null,
    area_sqm_max:
      isCommercialType(form.property_type) && form.area_sqm_max ? Number(form.area_sqm_max) : null,
    description: form.description || null,
    amenities: form.amenities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    images: media.images,
    video_url: media.video_url,
    tour_url: media.tour_url,
    ...contactPhoneFields(form.contact_phones),
    contact_name: form.contact_name.trim() || null,
    minimum_rent_period_months:
      isCommercialType(form.property_type) && form.pricing_mode === "rent"
        ? Number(form.minimum_rent_period_months)
        : null,
    pricing_mode: form.pricing_mode,
    price_period: form.pricing_mode === "sale" ? null : form.price_period || null,
    is_active: true,
  };
}

function listingSuccessMessage(
  onBehalfOf: ListingOnBehalfTarget | undefined,
  adminOwned: boolean | undefined,
  created: { health_score?: number | null; authenticity_score?: number | null },
) {
  const stats = `health ${created.health_score ?? "—"} · authenticity ${created.authenticity_score ?? "—"}`;
  if (onBehalfOf) {
    return `Listed on behalf of ${onBehalfOf.displayName}! Area stats: ${stats}`;
  }
  if (adminOwned) {
    return `Admin listing published! Area stats: ${stats}`;
  }
  return `Property listed! Area stats: ${stats}`;
}

function wizardHeading(onBehalfOf: ListingOnBehalfTarget | undefined, adminOwned: boolean): string {
  if (onBehalfOf) return "List on behalf of account";
  if (adminOwned) return "Upload listing as admin";
  return "Add a property";
}

function wizardSubtitle(
  onBehalfOf: ListingOnBehalfTarget | undefined,
  adminOwned: boolean,
  portalLabel: string,
): string {
  if (onBehalfOf) {
    return `Publishing for ${onBehalfOf.displayName} (${portalLabelForRole(onBehalfOf.portalRole)}) — leads and billing go to their account.`;
  }
  if (adminOwned) {
    return "You own this listing. Add contact name + phone (WhatsApp inquiries), media, and map pin.";
  }
  return `${portalLabel} portal — add details, upload media, and pin the exact location on the map.`;
}

async function createListingFromWizard(
  form: ListingFormState,
  payload: ReturnType<typeof buildListingPayload>,
  onBehalfOf: ListingOnBehalfTarget | undefined,
  adminOwned: boolean | undefined,
) {
  if (onBehalfOf) {
    return createPropertyOnBehalf({ data: { ...payload, ownerUserId: onBehalfOf.userId } });
  }
  if (adminOwned) {
    const contact = contactPhoneFields(form.contact_phones);
    return createAdminProperty({
      data: {
        ...payload,
        contact_phone: contact.contact_phone,
        contact_phones: contact.contact_phones,
        contact_name: form.contact_name.trim(),
      },
    });
  }
  return createProperty({ data: payload });
}

function getSubmitLabel(
  isLastTab: boolean,
  uploading: boolean,
  uploadProgress: number | null,
  loading: boolean,
): string {
  if (!isLastTab) return "Continue";
  if (uploading && uploadProgress !== null) return `Uploading media… ${uploadProgress}%`;
  if (uploading) return "Uploading media…";
  if (loading) return "Publishing…";
  return "Publish listing";
}

function filterValidImageFiles(files: File[]): File[] {
  return files.filter((f) => {
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
}

function parseVideoUpload(files: File[]): File | null {
  const file = files[0];
  if (!file) return null;
  if (!file.type.startsWith("video/")) {
    toast.error("Please choose a video file");
    return null;
  }
  if (!isWithinUploadLimit(file, "video")) {
    toast.error(`Video must be under ${uploadLimitLabel("video")}`);
    return null;
  }
  return file;
}

function parseTourUpload(files: File[]): File | null {
  const file = files[0];
  if (!file) return null;
  if (!file.type.startsWith("image/")) {
    toast.error("360° tour upload must be an equirectangular image");
    return null;
  }
  if (!isWithinUploadLimit(file, "tour")) {
    toast.error(`360° image must be under ${uploadLimitLabel("tour")}`);
    return null;
  }
  return file;
}

type PublishListingInput = {
  form: ListingFormState;
  userId: string;
  onBehalfOf?: ListingOnBehalfTarget;
  adminOwned?: boolean;
  imageFiles: File[];
  videoFile: File | null;
  tourFile: File | null;
  isAgency: boolean;
  isManager: boolean;
  redirectTo?: string;
  redirectSearch?: Record<string, unknown>;
  navigate: ReturnType<typeof useNavigate>;
  setLoading: (value: boolean) => void;
  setUploading: (value: boolean) => void;
  setUploadProgress: (value: number | null) => void;
  propertyKeyRef: { current: string | null };
};

function canAdvanceToTab(
  activeTab: TabId,
  targetTab: TabId,
  validate: (tab: TabId) => boolean,
): boolean {
  const currentIndex = TABS.findIndex((t) => t.id === activeTab);
  const targetIndex = TABS.findIndex((t) => t.id === targetTab);
  if (targetIndex <= currentIndex) return true;
  for (let i = currentIndex; i < targetIndex; i++) {
    if (!validate(TABS[i].id)) return false;
  }
  return true;
}

function publishBlockReason(
  user: { id: string } | null | undefined,
  onBehalfOf?: ListingOnBehalfTarget,
): string | null {
  if (!user) return "Sign in to list a property";
  if (onBehalfOf && !onBehalfOf.userId) {
    return "Select a landlord, agency, or manager account first";
  }
  return null;
}

async function publishListing(input: PublishListingInput) {
  const {
    form,
    userId,
    onBehalfOf,
    adminOwned,
    imageFiles,
    videoFile,
    tourFile,
    isAgency,
    isManager,
    redirectTo,
    redirectSearch,
    navigate,
    setLoading,
    setUploading,
    setUploadProgress,
    propertyKeyRef,
  } = input;

  setLoading(true);
  try {
    const existingKey = getListingUploadSnapshot().propertyKey;
    if (!propertyKeyRef.current) {
      propertyKeyRef.current = existingKey ?? randomUuid();
    }
    const propertyKey = propertyKeyRef.current;

    await runDurableListingUpload(propertyKey, async (controller) => {
      setUploading(true);
      setUploadProgress(0);
      controller.setPhase("enhancing");

      const media = await uploadListingMedia({
        userId,
        propertyKey,
        imageFiles,
        videoFile,
        tourFile,
        externalVideoUrl: form.video_url,
        externalTourUrl: form.tour_url,
        adminOnBehalf: Boolean(onBehalfOf) || Boolean(adminOwned),
        onProgress: (percent) => {
          controller.setProgress(percent);
          setUploadProgress(percent);
        },
        controller,
      });
      setUploading(false);
      setUploadProgress(null);
      controller.setPhase("publishing");

      const payload = buildListingPayload(form, media);
      const created = await createListingFromWizard(form, payload, onBehalfOf, adminOwned);

      toast.success(listingSuccessMessage(onBehalfOf, adminOwned, created));
      try {
        const report = await analyzePropertyQuality({ data: { propertyId: created.id } });
        toast.success(`Listing quality: ${report.grade} (${report.score}/100)`, {
          description: report.summary,
          duration: 8000,
        });
      } catch (err) {
        toast.warning("Quality analysis failed", { description: errorMessage(err) });
      }

      if (redirectTo) {
        navigate({ to: redirectTo, search: redirectSearch });
      } else {
        navigate({ to: propertiesListPath(isAgency, isManager) });
      }
      return created;
    });
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    setLoading(false);
    setUploading(false);
    setUploadProgress(null);
  }
}

export function PropertyListingWizard({
  portalLabel = "Landlord",
  onBehalfOf,
  adminOwned = false,
  redirectTo,
  redirectSearch,
}: Readonly<{
  portalLabel?: string;
  onBehalfOf?: ListingOnBehalfTarget;
  /** Admin creates a listing owned by their own account (requires contact phone). */
  adminOwned?: boolean;
  redirectTo?: string;
  redirectSearch?: Record<string, unknown>;
}>) {
  const navigate = useNavigate();
  const { user, isAgency, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [tourFile, setTourFile] = useState<File | null>(null);
  const propertyKeyRef = useRef<string | null>(null);

  const onUploadSnapshot = useCallback((snapshot: { phase: string; progress: number | null }) => {
    const busyPhase =
      snapshot.phase === "enhancing" ||
      snapshot.phase === "uploading" ||
      snapshot.phase === "publishing";
    setLoading(busyPhase);
    setUploading(snapshot.phase === "enhancing" || snapshot.phase === "uploading");
    setUploadProgress(
      snapshot.phase === "uploading" || snapshot.phase === "enhancing" ? snapshot.progress : null,
    );
    if (snapshot.phase === "done" || snapshot.phase === "error" || snapshot.phase === "idle") {
      setLoading(false);
      setUploading(false);
      setUploadProgress(null);
    }
  }, []);
  useKeepListingUploadAlive(onUploadSnapshot);
  const [form, setForm] = useState<ListingFormState>({
    title: "",
    property_type: "one_bedroom" as PropertyType,
    neighborhood: "",
    address: "",
    contact_phones: [""],
    contact_name: "",
    rent_kes: 0,
    rent_kes_max: "" as number | "",
    deposit_kes: 0,
    bedrooms: 1,
    bathrooms: 1,
    area_sqm: 0,
    area_sqm_max: "" as number | "",
    description: "",
    amenities: "",
    video_url: "",
    tour_url: "",
    minimum_rent_period_months: "" as number | "",
    pricing_mode: defaultPricingMode("one_bedroom"),
    price_period: (defaultPricePeriod("one_bedroom", defaultPricingMode("one_bedroom")) ??
      "month") as PricePeriod,
    latitude: null as number | null,
    longitude: null as number | null,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onPickImages(files: File[]) {
    const valid = filterValidImageFiles(files);
    setImageFiles((prev) => [...prev, ...valid].slice(0, 15));
  }

  function onPickVideo(files: File[]) {
    const file = parseVideoUpload(files);
    if (file) setVideoFile(file);
  }

  function onPickTour(files: File[]) {
    const file = parseTourUpload(files);
    if (file) setTourFile(file);
  }

  function removeImageAt(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function validateTab(tab: TabId): boolean {
    return validateListingTab(tab, form, imageFiles.length, adminOwned);
  }

  function switchTab(tab: TabId) {
    if (!canAdvanceToTab(activeTab, tab, validateTab)) return;
    setActiveTab(tab);
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateTab("details") || !validateTab("media") || !validateTab("location")) return;
    const blockReason = publishBlockReason(user, onBehalfOf);
    if (blockReason || !user) {
      if (blockReason) toast.error(blockReason);
      return;
    }

    await publishListing({
      form,
      userId: onBehalfOf?.userId ?? user.id,
      onBehalfOf,
      adminOwned,
      imageFiles,
      videoFile,
      tourFile,
      isAgency,
      isManager,
      redirectTo,
      redirectSearch,
      navigate,
      setLoading,
      setUploading,
      setUploadProgress,
      propertyKeyRef,
    });
  }

  const busy = loading || uploading;
  const tabIndex = TABS.findIndex((t) => t.id === activeTab);
  const isLastTab = activeTab === "review";

  function goNext(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateTab(activeTab)) return;
    if (isLastTab) return;
    setActiveTab(TABS[tabIndex + 1].id);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">
        {wizardHeading(onBehalfOf, adminOwned)}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {wizardSubtitle(onBehalfOf, adminOwned, portalLabel)}
      </p>
      {onBehalfOf ? (
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">On behalf of:</span> {onBehalfOf.displayName}
        </div>
      ) : null}

      {busy ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Upload in progress
          {uploadProgress != null ? ` · ${uploadProgress}%` : ""}. Keep this tab open — switching
          apps is fine, but closing the page will cancel it.
        </div>
      ) : null}

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
        <ListingWizardTabContent
          activeTab={activeTab}
          form={form}
          update={update}
          busy={busy}
          requireContactPhone={adminOwned}
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
            {getSubmitLabel(isLastTab, uploading, uploadProgress, loading)}
          </button>
        </div>
      </form>
    </div>
  );
}
