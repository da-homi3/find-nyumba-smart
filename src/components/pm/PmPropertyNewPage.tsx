import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createPmProperty } from "@/lib/api/pm.functions";
import { pmBasePath, type PmPortal } from "@/components/pm/pm-nav";

const TYPES = [
  { id: "apartment_block", label: "Apartment block" },
  { id: "estate", label: "Estate" },
  { id: "single_unit", label: "Single unit" },
  { id: "commercial", label: "Commercial" },
  { id: "mixed_use", label: "Mixed use" },
] as const;

export function PmPropertyNewPage({ portal }: Readonly<{ portal: PmPortal }>) {
  const navigate = useNavigate();
  const base = pmBasePath(portal);
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] =
    useState<(typeof TYPES)[number]["id"]>("apartment_block");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createPmProperty({
        data: { name, propertyType, address, neighborhood },
      }),
    onSuccess: (row) => {
      toast.success("Property created");
      navigate({ to: `${base}/${row.id}` });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">New managed property</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No marketplace listing is created until you publish a vacant unit.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Kilimani Heights"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Type</span>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as typeof propertyType)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Neighborhood</span>
          <input
            required
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Kilimani"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Address</span>
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Argwings Kodhek Rd"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Create property"}
        </button>
      </form>
    </div>
  );
}
