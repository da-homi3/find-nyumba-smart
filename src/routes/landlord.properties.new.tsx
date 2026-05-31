import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { PropertyType } from "@/lib/properties";

export const Route = createFileRoute("/landlord/properties/new")({
  component: () => (
    <LandlordShell>
      <Page />
    </LandlordShell>
  ),
});

function Page() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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
    image_url: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("properties").insert({
        owner_id: user.id,
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
        images: form.image_url ? [form.image_url] : [],
        is_active: true,
      });
      if (error) throw error;
      toast.success("Property listed!");
      navigate({ to: "/landlord/properties" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Add a property</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill out the basics — you can refine details and photos later.
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
          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Street, building"
              className={inputCls}
            />
          </Field>
          <Field label="Cover image URL">
            <input
              value={form.image_url}
              onChange={(e) => update("image_url", e.target.value)}
              placeholder="https://…"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
        >
          {loading ? "Publishing…" : "Publish property"}
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
  label: string;
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
