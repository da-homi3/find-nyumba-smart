import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { addPmTenant, updatePmTenant } from "@/lib/api/pm.functions";
import { uploadStorageBatchWithProgress } from "@/lib/media/storage-upload";
import { createSignedMediaUrls } from "@/lib/api/media.functions";
import { randomUuid } from "@/lib/random-uuid";

type CustomField = { label: string; value: string };

type TenantRow = {
  id?: string;
  property_id?: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
  national_id?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  occupation?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  custom_fields?: string | null;
};

function parseCustomFields(raw: string | null | undefined): CustomField[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function TenantProfileForm({
  tenant,
  propertyId,
  onClose,
}: Readonly<{
  tenant?: TenantRow | null;
  propertyId: string;
  onClose?: () => void;
}>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!tenant?.id;

  const [fullName, setFullName] = useState(tenant?.full_name ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? "");
  const [email, setEmail] = useState(tenant?.email ?? "");
  const [nationalId, setNationalId] = useState(tenant?.national_id ?? "");
  const [emergencyName, setEmergencyName] = useState(tenant?.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(tenant?.emergency_contact_phone ?? "");
  const [occupation, setOccupation] = useState(tenant?.occupation ?? "");
  const [notes, setNotes] = useState(tenant?.notes ?? "");
  const [photoUrl, setPhotoUrl] = useState(tenant?.photo_url ?? "");
  const [customFields, setCustomFields] = useState<CustomField[]>(
    parseCustomFields(tenant?.custom_fields),
  );
  const [uploading, setUploading] = useState(false);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${propertyId}/tenant-${randomUuid()}.${ext}`;
      await uploadStorageBatchWithProgress(
        [{ bucket: "property-media", path, file }],
        () => {},
      );
      const signed = await createSignedMediaUrls({ data: { paths: [path] } });
      if (signed[0]?.signedUrl) setPhotoUrl(signed[0].signedUrl);
    } catch {
      toast.error("Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addField() {
    setCustomFields([...customFields, { label: "", value: "" }]);
  }
  function updateField(i: number, key: "label" | "value", val: string) {
    const next = [...customFields];
    next[i] = { ...next[i], [key]: val };
    setCustomFields(next);
  }
  function removeField(i: number) {
    setCustomFields(customFields.filter((_, idx) => idx !== i));
  }

  const save = useMutation({
    mutationFn: async () => {
      const fields = customFields.filter((f) => f.label.trim() || f.value.trim());
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        nationalId: nationalId.trim() || null,
        emergencyContactName: emergencyName.trim() || null,
        emergencyContactPhone: emergencyPhone.trim() || null,
        occupation: occupation.trim() || null,
        notes: notes.trim() || null,
        photoUrl: photoUrl || null,
        customFields: fields.length ? fields : null,
      };
      if (isEdit) {
        return updatePmTenant({ data: { tenantId: tenant!.id!, ...payload } });
      }
      return addPmTenant({ data: { propertyId, ...payload } });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Tenant profile updated" : "Tenant added");
      qc.invalidateQueries({ queryKey: ["pm-tenants", propertyId] });
      onClose?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  let photoLabel = "Add photo (optional)";
  if (uploading) photoLabel = "Uploading…";
  else if (photoUrl) photoLabel = "Change photo";

  const inputCls =
    "w-full rounded-lg border border-white/10 bg-[#1c2128] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:outline-none";

  return (
    <div className="space-y-5">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="flex h-18 w-18 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1c2128]">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl text-white/30">{fullName[0] || "?"}</span>
          )}
        </div>
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#1c2128] px-3 py-2 text-[13px] text-white hover:border-white/20">
            <Camera className="h-4 w-4" />
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            {photoLabel}
          </label>
          <p className="mt-1 text-[11.5px] text-white/35">
            Helps caretakers and staff recognise tenants on-site
          </p>
        </div>
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tp-name" className="mb-1 block text-[13px] font-medium text-white">
            Full name <span className="text-red-400">*</span>
          </label>
          <input id="tp-name" className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiku" />
        </div>
        <div>
          <label htmlFor="tp-phone" className="mb-1 block text-[13px] font-medium text-white">
            Phone <span className="text-red-400">*</span>
          </label>
          <input id="tp-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tp-email" className="mb-1 block text-[13px] font-medium text-white">Email</label>
          <input id="tp-email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        </div>
        <div>
          <label htmlFor="tp-nid" className="mb-1 block text-[13px] font-medium text-white">National ID</label>
          <input id="tp-nid" className={inputCls} value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="12345678" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tp-ecname" className="mb-1 block text-[13px] font-medium text-white">Emergency contact name</label>
          <input id="tp-ecname" className={inputCls} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tp-ecphone" className="mb-1 block text-[13px] font-medium text-white">Emergency contact phone</label>
          <input id="tp-ecphone" className={inputCls} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
        </div>
      </div>

      <div>
        <label htmlFor="tp-occ" className="mb-1 block text-[13px] font-medium text-white">Occupation</label>
        <input id="tp-occ" className={inputCls} value={occupation} onChange={(e) => setOccupation(e.target.value)} />
      </div>

      {/* Custom fields */}
      <div>
        <span className="text-[13.5px] font-semibold text-white">Custom details</span>
        <p className="mb-2.5 mt-0.5 text-[12px] text-white/40">
          Add anything specific to this tenant — vehicle plate, pet details, guarantor, whatever's useful to you.
        </p>
        <p className="mb-3 text-[11px] text-white/35">
          Avoid recording health information, immigration status, or other sensitive personal details in custom
          fields unless legally required for your tenancy agreement.
        </p>
        {customFields.map((field, i) => (
          <div key={`cf-${field.label}-${i}`} className="mb-2 flex gap-2">
            <input
              className={inputCls}
              placeholder="Label (e.g. Vehicle plate)"
              value={field.label}
              onChange={(e) => updateField(i, "label", e.target.value)}
            />
            <input
              className={`${inputCls} flex-[1.5]`}
              placeholder="Value"
              value={field.value}
              onChange={(e) => updateField(i, "value", e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeField(i)}
              className="shrink-0 text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-500/40 px-3 py-2 text-[13px] text-emerald-400 hover:border-emerald-500/60"
        >
          <Plus className="h-3.5 w-3.5" /> Add a custom field
        </button>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="tp-notes" className="mb-1 block text-[13px] font-medium text-white">Notes</label>
        <textarea id="tp-notes" className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {/* Save */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!fullName.trim() || !phone.trim() || save.isPending}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Update tenant" : "Add tenant"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
