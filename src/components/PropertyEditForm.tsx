import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getManageableProperty, updateProperty } from "@/lib/api/nyumba.functions";
import { PropertyMediaManager } from "@/components/PropertyMediaManager";
import type { PropertyType } from "@/lib/properties";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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

function optionalNumberField(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

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
    latitude: "",
    longitude: "",
    rent_kes: "",
    deposit_kes: "",
    bedrooms: "1",
    bathrooms: "1",
    description: "",
    video_url: "",
    tour_url: "",
  });

  useEffect(() => {
    if (!property) return;
    setForm({
      title: property.title,
      property_type: property.property_type,
      neighborhood: property.neighborhood,
      address: property.address ?? "",
      latitude: optionalNumberField(property.latitude),
      longitude: optionalNumberField(property.longitude),
      rent_kes: String(property.rent_kes),
      deposit_kes: optionalNumberField(property.deposit_kes),
      bedrooms: String(property.bedrooms),
      bathrooms: String(property.bathrooms),
      description: property.description ?? "",
      video_url: property.video_url ?? "",
      tour_url: property.tour_url ?? "",
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
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          rent_kes: Number.parseInt(form.rent_kes, 10),
          deposit_kes: form.deposit_kes ? Number.parseInt(form.deposit_kes, 10) : null,
          bedrooms: Number.parseInt(form.bedrooms, 10),
          bathrooms: Number.parseInt(form.bathrooms, 10),
          description: form.description.trim() || null,
          amenities: property?.amenities ?? [],
          images: property?.images ?? [],
          video_url: form.video_url.trim() || null,
          tour_url: form.tour_url.trim() || null,
          is_active: property?.is_active ?? true,
        },
      }),
    onSuccess: () => {
      toast.success("Property updated");
      if (invalidateQueryKey) {
        void qc.invalidateQueries({ queryKey: [invalidateQueryKey] });
      }
      navigate({ to: backTo });
    },
    onError: (err: Error) => toast.error(errorMessage(err)),
  });

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
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link to={backTo} className="text-sm text-primary">
        ← Properties
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">Edit listing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update details, media links, and map pin — tenants see changes immediately.
      </p>

      <form
        className="mt-8 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Property type</span>
          <select
            value={form.property_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, property_type: e.target.value as PropertyType }))
            }
            className="rounded-xl border px-3 py-2"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Neighborhood</span>
          <input
            required
            value={form.neighborhood}
            onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
            className="rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Address (optional)</span>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="rounded-xl border px-3 py-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Latitude (map pin)</span>
            <input
              type="number"
              step="any"
              placeholder="-1.2921"
              value={form.latitude}
              onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              className="rounded-xl border px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Longitude (map pin)</span>
            <input
              type="number"
              step="any"
              placeholder="36.8219"
              value={form.longitude}
              onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              className="rounded-xl border px-3 py-2"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: open{" "}
          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Google Maps
          </a>
          {", right-click your property, and copy coordinates to show it on the tenant map."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Rent (KES)</span>
            <input
              required
              type="number"
              value={form.rent_kes}
              onChange={(e) => setForm((f) => ({ ...f, rent_kes: e.target.value }))}
              className="rounded-xl border px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Deposit (KES)</span>
            <input
              type="number"
              value={form.deposit_kes}
              onChange={(e) => setForm((f) => ({ ...f, deposit_kes: e.target.value }))}
              className="rounded-xl border px-3 py-2"
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Video URL (YouTube, etc.)</span>
          <input
            type="url"
            value={form.video_url}
            onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
            className="rounded-xl border px-3 py-2"
            placeholder="https://"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Virtual tour link</span>
          <input
            type="url"
            value={form.tour_url}
            onChange={(e) => setForm((f) => ({ ...f, tour_url: e.target.value }))}
            className="rounded-xl border px-3 py-2"
            placeholder="https://"
          />
        </label>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="mt-10">
        <h2 className="font-semibold">Photos & media</h2>
        <PropertyMediaManager property={property} />
      </div>
    </div>
  );
}
