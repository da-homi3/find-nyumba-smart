import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PartnerShell } from "@/components/partner/PartnerShell";
import { useActivePilotId, usePilotDetail } from "@/hooks/use-partner-pilot";
import { savePilotOnboarding } from "@/lib/api/pilot-partnership.functions";
import { PILOT_PARTNER_TYPES } from "@/lib/pilot/types";

export const Route = createFileRoute("/partner/onboarding")({
  head: () => ({ meta: [{ title: "Partner profile — NyumbaSearch" }] }),
  component: () => (
    <PartnerShell>
      <PartnerProfileForm />
    </PartnerShell>
  ),
});

type OrgForm = {
  name: string;
  partnerType: string;
  description: string;
  website: string;
  email: string;
  phone: string;
  officeLocation: string;
};

type ContactsForm = {
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
};

function PartnerProfileForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { pilotId } = useActivePilotId();
  const { data, isLoading } = usePilotDetail(pilotId);
  const [hydrated, setHydrated] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const [org, setOrg] = useState<OrgForm>({
    name: "",
    partnerType: "REAL_ESTATE_AGENCY",
    description: "",
    website: "",
    email: "",
    phone: "",
    officeLocation: "",
  });
  const [contacts, setContacts] = useState<ContactsForm>({
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
  });
  const [portfolioNote, setPortfolioNote] = useState("");
  const [objectivesText, setObjectivesText] = useState("");

  useEffect(() => {
    if (!data?.pilot || hydrated) return;
    const onboarding = (data.pilot.onboarding ?? {}) as Record<string, Record<string, unknown>>;
    const savedOrg = (onboarding.organization ?? {}) as Partial<OrgForm>;
    const savedContacts = (onboarding.contacts ?? {}) as Partial<ContactsForm>;
    const savedPortfolio = (onboarding.portfolio ?? {}) as { note?: string };
    const savedObjectives = (onboarding.objectives ?? {}) as { items?: string[] | string };

    setOrg({
      name:
        savedOrg.name ??
        (data.pilot.partner_name?.startsWith("Pending") ||
        data.pilot.partner_name?.startsWith("Partner invite")
          ? ""
          : data.pilot.partner_name) ??
        "",
      partnerType: savedOrg.partnerType ?? data.pilot.partner_type ?? "REAL_ESTATE_AGENCY",
      description: savedOrg.description ?? "",
      website: savedOrg.website ?? "",
      email: savedOrg.email ?? data.pilot.primary_contact_email ?? "",
      phone: savedOrg.phone ?? data.pilot.primary_contact_phone ?? "",
      officeLocation: savedOrg.officeLocation ?? "",
    });
    setContacts({
      primaryContactName: savedContacts.primaryContactName ?? data.pilot.primary_contact_name ?? "",
      primaryContactEmail:
        savedContacts.primaryContactEmail ?? data.pilot.primary_contact_email ?? "",
      primaryContactPhone:
        savedContacts.primaryContactPhone ?? data.pilot.primary_contact_phone ?? "",
    });
    setPortfolioNote(savedPortfolio.note ?? "");
    const objItems = Array.isArray(savedObjectives.items)
      ? savedObjectives.items.join("\n")
      : typeof savedObjectives.items === "string"
        ? savedObjectives.items
        : Array.isArray(data.pilot.objectives)
          ? (data.pilot.objectives as string[]).join("\n")
          : "";
    setObjectivesText(objItems);
    if (savedPortfolio.note || objItems || savedOrg.description || savedOrg.website) {
      setShowMore(true);
    }
    setHydrated(true);
  }, [data, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      if (!pilotId) throw new Error("No pilot selected");
      await savePilotOnboarding({
        data: {
          pilotId,
          step: "organization",
          payload: { ...org },
        },
      });
      await savePilotOnboarding({
        data: {
          pilotId,
          step: "contacts",
          payload: { ...contacts },
        },
      });
      if (portfolioNote.trim()) {
        await savePilotOnboarding({
          data: {
            pilotId,
            step: "portfolio",
            payload: { note: portfolioNote.trim() },
          },
        });
      }
      if (objectivesText.trim()) {
        await savePilotOnboarding({
          data: {
            pilotId,
            step: "objectives",
            payload: {
              items: objectivesText
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            },
          },
        });
      }
      return savePilotOnboarding({
        data: {
          pilotId,
          step: "criteria",
          payload: { items: [] },
          complete: true,
        },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pilot-detail", pilotId] });
      void qc.invalidateQueries({ queryKey: ["my-pilots"] });
      toast.success("Profile saved — your dashboard is ready");
      navigate({ to: "/partner" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 pb-20 lg:px-10">
      <header className="max-w-xl">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Optional · takes about 2 minutes
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">A few details about you</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your pilot dashboard already works. This just helps tenants and NyumbaSearch recognise
          your brand — skip anything you do not have yet.
        </p>
      </header>

      <div className="mt-8 max-w-xl space-y-4 rounded-xl border bg-card p-5">
        <Field
          label="Company / brand name"
          value={org.name}
          onChange={(v) => setOrg({ ...org, name: v })}
          required
          hint="The name people will see on your partner profile."
        />
        <label className="block text-sm font-medium">
          What best describes you?
          <select
            value={org.partnerType}
            onChange={(e) => setOrg({ ...org, partnerType: e.target.value })}
            className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
          >
            {PILOT_PARTNER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Your name"
          value={contacts.primaryContactName}
          onChange={(v) => setContacts({ ...contacts, primaryContactName: v })}
        />
        <Field
          label="Phone (WhatsApp-friendly)"
          value={contacts.primaryContactPhone || org.phone}
          onChange={(v) => {
            setContacts({ ...contacts, primaryContactPhone: v });
            setOrg({ ...org, phone: v });
          }}
        />
        <Field
          label="Contact email"
          value={contacts.primaryContactEmail || org.email}
          onChange={(v) => {
            setContacts({ ...contacts, primaryContactEmail: v });
            setOrg({ ...org, email: v });
          }}
        />

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition ${showMore ? "rotate-180" : ""}`} />
          {showMore ? "Hide extra details" : "Add more (optional)"}
        </button>

        {showMore ? (
          <div className="space-y-4 border-t pt-4">
            <Field
              label="Short description"
              value={org.description}
              onChange={(v) => setOrg({ ...org, description: v })}
              multiline
              hint="One or two sentences is enough."
            />
            <Field
              label="Website"
              value={org.website}
              onChange={(v) => setOrg({ ...org, website: v })}
            />
            <Field
              label="Office / area"
              value={org.officeLocation}
              onChange={(v) => setOrg({ ...org, officeLocation: v })}
            />
            <Field
              label="Portfolio note"
              value={portfolioNote}
              onChange={setPortfolioNote}
              multiline
              hint="Neighbourhoods or property types you plan to list — optional."
            />
            <Field
              label="Goals (one per line)"
              value={objectivesText}
              onChange={setObjectivesText}
              multiline
              hint="Example: More qualified enquiries in Kilimani"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            if (!org.name.trim()) {
              toast.error("Add a company name — or skip for now");
              return;
            }
            void save.mutateAsync();
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save & open dashboard"}
        </button>
        <Link
          to="/partner"
          className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-muted-foreground"
        >
          Skip for now
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  hint,
  required,
}: Readonly<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
  required?: boolean;
}>) {
  const cls =
    "mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50";
  return (
    <label className="block text-sm font-medium">
      {label}
      {required ? <span className="text-muted-foreground"> *</span> : null}
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
