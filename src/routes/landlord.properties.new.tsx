import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { createProperty } from "@/lib/api/nyumba.functions";
import { analyzePropertyQuality, createSignedMediaUrls } from "@/lib/api/media.functions";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { toast } from "sonner";
import type { PropertyType } from "@/lib/properties";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Image as ImageIcon, Film, Compass, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/landlord/properties/new")({
  component: () => (
    <LandlordShell>
      <Page />
    </LandlordShell>
  ),
});

const MAX_IMG_MB = 10;
const MAX_VIDEO_MB = 100;

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
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
    tour_url: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onPickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: not an image`);
        return false;
      }
      if (f.size > MAX_IMG_MB * 1024 * 1024) {
        toast.error(`${f.name}: max ${MAX_IMG_MB}MB`);
        return false;
      }
      return true;
    });
    setImageFiles((prev) => [...prev, ...valid].slice(0, 15));
    e.target.value = "";
  }

  function onPickVideo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Please choose a video file");
      return;
    }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Video must be under ${MAX_VIDEO_MB}MB`);
      return;
    }
    setVideoFile(f);
    e.target.value = "";
  }

  async function uploadAll(propertyKey: string) {
    if (!user) throw new Error("Sign in required");
    setUploading(true);
    try {
      const uploadedImagePaths: string[] = [];
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${propertyKey}/img-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("property-media")
          .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
        if (error) throw error;
        uploadedImagePaths.push(path);
      }

      let videoPath: string | null = null;
      if (videoFile) {
        const ext = videoFile.name.split(".").pop() ?? "mp4";
        const path = `${user.id}/${propertyKey}/video-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("property-media")
          .upload(path, videoFile, { cacheControl: "31536000", upsert: false, contentType: videoFile.type });
        if (error) throw error;
        videoPath = path;
      }

      const allPaths = [...uploadedImagePaths, ...(videoPath ? [videoPath] : [])];
      if (allPaths.length === 0) return { images: [] as string[], video_url: null as string | null };

      const signed = await createSignedMediaUrls({
        data: { paths: allPaths },
      });
      const map = new Map<string, string>();
      for (const s of signed) {
        if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
      }
      return {
        images: uploadedImagePaths.map((p) => map.get(p)!).filter(Boolean),
        video_url: videoPath ? (map.get(videoPath) ?? null) : null,
      };
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in as a landlord first");
      return;
    }
    setLoading(true);
    try {
      const propertyKey = crypto.randomUUID();
      const media = await uploadAll(propertyKey);

      const created = await createProperty({
        data: {
          title: form.title,
          property_type: form.property_type,
          neighborhood: form.neighborhood,
          address: form.address || null,
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
          tour_url: form.tour_url.trim() || null,
          is_active: true,
        },
      });

      toast.success("Property listed! Running quality analysis…");
      try {
        const report = await analyzePropertyQuality({ data: { propertyId: created.id } });
        toast.success(`Listing quality: ${report.grade} (${report.score}/100)`, {
          description: report.summary,
          duration: 8000,
        });
      } catch (err) {
        toast.warning("Quality analysis failed", { description: (err as Error).message });
      }

      navigate({ to: "/landlord/properties" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || uploading;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Add a property</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload photos, a walkthrough video, and an optional 360° tour. We'll auto-score your listing.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl border bg-card p-6 shadow-soft"
      >
        <Row>
          <Field label="Title" full>
            <input
              required
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Modern 2BR with City Views"
              className={inputCls}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Type">
            <select
              value={form.property_type}
              onChange={(e) => update("property_type", e.target.value as PropertyType)}
              className={inputCls}
            >
              {(
                [
                  "bedsitter",
                  "single_room",
                  "studio",
                  "one_bedroom",
                  "two_bedroom",
                  "three_bedroom",
                  "hostel",
                  "maisonette",
                  "bungalow",
                  "townhouse",
                ] as PropertyType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Neighborhood">
            <input
              required
              value={form.neighborhood}
              onChange={(e) => update("neighborhood", e.target.value)}
              placeholder="Kilimani"
              className={inputCls}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Address" full>
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Street, building"
              className={inputCls}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Rent (KES/mo)">
            <input
              required
              type="number"
              value={form.rent_kes || ""}
              onChange={(e) => update("rent_kes", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Deposit (KES)">
            <input
              type="number"
              value={form.deposit_kes || ""}
              onChange={(e) => update("deposit_kes", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Bedrooms">
            <input
              type="number"
              value={form.bedrooms}
              onChange={(e) => update("bedrooms", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Bathrooms">
            <input
              type="number"
              value={form.bathrooms}
              onChange={(e) => update("bathrooms", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Area (m²)">
            <input
              type="number"
              value={form.area_sqm || ""}
              onChange={(e) => update("area_sqm", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </Row>

        <Field label="Amenities (comma separated)" full>
          <input
            value={form.amenities}
            onChange={(e) => update("amenities", e.target.value)}
            placeholder="WiFi, Borehole, Parking"
            className={inputCls}
          />
        </Field>

        <Field label="Description" full>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Media */}
        <div className="rounded-xl border border-dashed bg-secondary/40 p-4">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <ImageIcon className="h-4 w-4" /> Photos
            <span className="text-xs font-normal text-muted-foreground">
              Up to 15, max {MAX_IMG_MB}MB each
            </span>
          </h3>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={onPickImages}
            className="mt-2 block w-full text-xs"
          />
          {imageFiles.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {imageFiles.map((f, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border bg-background">
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageFiles((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-foreground/80 p-1 text-background opacity-0 transition group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-dashed bg-secondary/40 p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
              <Film className="h-4 w-4" /> Walkthrough video
              <span className="text-xs font-normal text-muted-foreground">
                Max {MAX_VIDEO_MB}MB
              </span>
            </h3>
            <input
              type="file"
              accept="video/*"
              onChange={onPickVideo}
              className="mt-2 block w-full text-xs"
            />
            {videoFile && (
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)}MB
                <button
                  type="button"
                  onClick={() => setVideoFile(null)}
                  className="ml-2 text-destructive underline"
                >
                  remove
                </button>
              </p>
            )}
          </div>

          <Field label={
            <span className="flex items-center gap-2"><Compass className="h-4 w-4" /> 360° tour URL</span>
          }>
            <input
              type="url"
              value={form.tour_url}
              onChange={(e) => update("tour_url", e.target.value)}
              placeholder="https://my.matterport.com/show/?m=…"
              className={inputCls}
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {uploading ? "Uploading media…" : loading ? "Publishing…" : "Publish & analyze"}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 [&>label:only-child]:col-span-full">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2 md:col-span-3" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
