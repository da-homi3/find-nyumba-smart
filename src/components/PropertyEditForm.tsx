import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getManageableProperty, updateProperty } from "@/lib/api/nyumba.functions";
import { PropertyMediaManager } from "@/components/PropertyMediaManager";
import { PropertyLocationPicker } from "@/components/PropertyLocationPicker";
import { NAIROBI_NEIGHBORHOODS } from "@/data/nairobi-neighborhoods";
import type { PropertyType } from "@/lib/properties";
import { toast } from "sonner";
import { errorMessage, cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, MapPin } from "lucide-react";

const PROPERTY_TYPES: PropertyType[] = [
  "bedsitter",
  "single_room",
  "one_bedroom",
  "two_bedroom",
  "three_bedroom",
  "studio",
  "hostel",
  "maisonette",
  "bungalow",
  "townhouse",
];

const TABS = [
  { id: "details", label: "Details", icon: FileText },
  { id: "media", label: "Photos & media", icon: ImageIcon },
  { id: "location", label: "Map pin", icon: MapPin },
] as const;

type TabId = (typeof TABS)[number]["id"];

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

type PropertyEditFormProps = Readonly<{
  propertyId: string;
  backTo: "/landlord/properties" | "/agency/properties" | "/manager/properties";
  invalidateQueryKey?: string;
}>;

export function PropertyEditForm({
  propertyId,
  backTo,
  invalidateQueryKey,
}: PropertyEditFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const { data: property, isLoading } = useQuery({
    queryKey: ["manageable-property", propertyId],
    enabled: !!user,
    queryFn: () => getManageableProperty({ data: { id: propertyId } }),
  });
  const [form, setForm] = useState({
    title: "",
    property_type: "one_bedroom" as PropertyType,
    neighborhood: "",
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
    rent_kes: "",
    deposit_kes: "",
    bedrooms: "1",
    bathrooms: "1",
    description: "",
    amenities: "",
  });

  useEffect(() => {
    if (!property) return;
    setForm({
      title: property.title,
      property_type: property.property_type,
      neighborhood: property.neighborhood,
      address: property.address ?? "",
      latitude: property.latitude,
      longitude: property.longitude,
      rent_kes: String(property.rent_kes),
      deposit_kes: property.deposit_kes != null ? String(property.deposit_kes) : "",
      bedrooms: String(property.bedrooms),
      bathrooms: String(property.bathrooms),
      description: property.description ?? "",
      amenities: (property.amenities ?? []).join(", "),
    });
  }, [property]);

  const save = useMutation({
    mutationFn: () =>
      updateProperty({
        data: {
          propertyId,
          title: form.title.trim(),
          property_type: form.property_type,
          neighborhood: form.neighborhood.trim(),
          address: form.address.trim() || null,
          latitude: form.latitude,
          longitude: form.longitude,
          rent_kes: Number.parseInt(form.rent_kes, 10),
          deposit_kes: form.deposit_kes ? Number.parseInt(form.deposit_kes, 10) : null,
          bedrooms: Number.parseInt(form.bedrooms, 10),
          bathrooms: Number.parseInt(form.bathrooms, 10),
          description: form.description.trim() || null,
          amenities: form.amenities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          images: property?.images ?? [],
          video_url: property?.video_url ?? null,
          tour_url: property?.tour_url ?? null,
          is_active: property?.is_active ?? true,
        },
      }),
    onSuccess: () => {
      toast.success("Property updated");
      void qc.invalidateQueries({ queryKey: ["manageable-property", propertyId] });
      if (invalidateQueryKey) {
        void qc.invalidateQueries({ queryKey: [invalidateQueryKey] });
      }
      navigate({ to: backTo });
    },
    onError: (err: Error) => toast.error(errorMessage(err)),
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    if (!form.title.trim() || !form.neighborhood.trim()) {
      toast.error("Title and neighborhood are required");
      setActiveTab("details");
      return false;
    }
    if (!form.rent_kes || Number.parseInt(form.rent_kes, 10) <= 0) {
      toast.error("Enter a valid monthly rent");
      setActiveTab("details");
      return false;
    }
    if (form.latitude == null || form.longitude == null) {
      toast.error("Pin the property on the map");
      setActiveTab("location");
      return false;
    }
    return true;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Property not found.</p>
        <Link to={backTo} className="mt-4 inline-block text-primary">
          ← Back to properties
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to={backTo} className="text-sm text-primary">
        ← Properties
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">Edit listing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update details, media, and map pin — tenants see changes immediately.
      </p>

      <div
        className="mt-6 flex gap-1 overflow-x-auto border-b pb-px"
        role="tablist"
        aria-label="Edit listing sections"
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
              onClick={() => setActiveTab(tab.id)}
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
        className="mt-6 space-y-5 rounded-2xl border bg-card p-6 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validate()) return;
          save.mutate();
        }}
      >
        {activeTab === "details" && (
          <div className="space-y-5">
            <Field label="Listing title" full>
              <input
                required
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
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
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Neighborhood">
                <input
                  required
                  list="edit-nairobi-neighborhoods"
                  value={form.neighborhood}
                  onChange={(e) => update("neighborhood", e.target.value)}
                  placeholder="e.g. Tumaini, Rongai"
                  className={inputCls}
                />
                <datalist id="edit-nairobi-neighborhoods">
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
                className={inputCls}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bedrooms">
                <input
                  type="number"
                  min={0}
                  value={form.bedrooms}
                  onChange={(e) => update("bedrooms", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Bathrooms">
                <input
                  type="number"
                  min={1}
                  value={form.bathrooms}
                  onChange={(e) => update("bathrooms", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Description" full>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Amenities (comma separated)" full>
              <input
                value={form.amenities}
                onChange={(e) => update("amenities", e.target.value)}
                placeholder="WiFi, Parking, Gym"
                className={inputCls}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rent (KES/month)">
                <input
                  required
                  type="number"
                  min={1}
                  value={form.rent_kes}
                  onChange={(e) => update("rent_kes", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Deposit (KES)">
                <input
                  type="number"
                  min={0}
                  value={form.deposit_kes}
                  onChange={(e) => update("deposit_kes", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        )}

        {activeTab === "media" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload photos, walkthrough video, or 360° tour. Use &quot;Save media&quot; on this tab
              for uploads; use &quot;Save changes&quot; below for title, pricing, and map pin.
            </p>
            <PropertyMediaManager property={property} />
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

        <div className="flex gap-2 border-t pt-4">
          {activeTab !== "details" && (
            <button
              type="button"
              onClick={() =>
                setActiveTab(TABS[Math.max(0, TABS.findIndex((t) => t.id === activeTab) - 1)].id)
              }
              className="flex-1 rounded-xl border py-3 text-sm font-semibold"
            >
              Back
            </button>
          )}
          {activeTab !== "location" ? (
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  TABS[Math.min(TABS.length - 1, TABS.findIndex((t) => t.id === activeTab) + 1)].id,
                )
              }
              className="flex-1 rounded-xl border border-primary py-3 text-sm font-semibold text-primary"
            >
              Continue
            </button>
          ) : null}
          <button
            type="submit"
            disabled={save.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-emerald py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {save.isPending ? "Saving…" : "Save changes"}
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
