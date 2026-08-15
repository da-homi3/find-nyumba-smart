import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  createTenantProfileShare,
  getTenantProfileBundle,
  getTenantScoreHistory,
  revokeTenantProfileShare,
  updateTenantSearchPrefs,
} from "@/lib/api/tenant-profile.functions";
import { formatKes } from "@/lib/properties";
import { errorMessage } from "@/lib/utils";

const ACTIONABLE = new Set([
  "phone",
  "email",
  "identity",
  "employment",
  "income",
  "tenancy",
  "locations",
  "budget",
  "move_in",
  "profile",
]);

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
      <span className="block">{label}</span>
      {children}
    </label>
  );
}

export function TenantProfileScoreCard({ userId }: Readonly<{ userId: string }>) {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-profile-bundle", userId],
    queryFn: () => getTenantProfileBundle(),
  });
  const { data: history = [] } = useQuery({
    queryKey: ["tenant-score-history", userId],
    queryFn: () => getTenantScoreHistory(),
  });

  if (isLoading || !data) {
    return <div className="mt-4 h-40 animate-pulse rounded-2xl bg-muted" />;
  }

  const { score } = data;
  const nextSteps = score.missing.filter((m) => ACTIONABLE.has(m.id)).slice(0, 3);
  const shareUrl = data.prefs.shareToken
    ? `${globalThis.location.origin}/t/${data.prefs.shareToken}`
    : null;

  return (
    <section className="mt-4 rounded-2xl border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Tenant Profile</p>
      <p className="mt-1 font-display text-4xl font-semibold text-primary">{score.percent}%</p>
      <p className="text-sm text-muted-foreground">Profile completeness — not a credit score</p>
      <p className="mt-2 text-xs text-muted-foreground">{score.disclaimer}</p>
      {nextSteps.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {nextSteps.map((step) => (
            <li key={step.id}>
              +{step.points} {step.action}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm">Your profile is highly complete.</p>
      )}
      <ScoreBreakdown awarded={score.awarded} missing={score.missing} />
      <PrefsForm
        locations={data.prefs.preferredLocations}
        budgetMin={data.prefs.budgetMin ? String(data.prefs.budgetMin) : ""}
        budgetMax={data.prefs.budgetMax ? String(data.prefs.budgetMax) : ""}
        bedrooms={data.prefs.bedrooms ? String(data.prefs.bedrooms) : ""}
        moveIn={data.prefs.moveInDate}
        tenancy={data.prefs.previousTenancy}
      />
      <SharePanel
        shareUrl={shareUrl}
        percent={score.percent}
        budgetMin={data.prefs.budgetMin}
        budgetMax={data.prefs.budgetMax}
      />
      {history.length > 1 ? (
        <div className="mt-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Score history</p>
          <p className="mt-1">{history.map((h) => `${h.percent}%`).join(" → ")}</p>
        </div>
      ) : null}
    </section>
  );
}

function ScoreBreakdown({
  awarded,
  missing,
}: Readonly<{
  awarded: Array<{ id: string; name: string; points: number }>;
  missing: Array<{ id: string; name: string; points: number }>;
}>) {
  const [howOpen, setHowOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        className="mt-3 text-xs font-semibold text-primary"
      >
        How is my score calculated?
      </button>
      {howOpen ? (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {awarded.map((item) => (
            <p key={item.id}>
              ✓ {item.name} (+{item.points})
            </p>
          ))}
          {missing.map((item) => (
            <p key={item.id}>
              ○ {item.name} (+{item.points})
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

function PrefsForm({
  locations: loc0,
  budgetMin: min0,
  budgetMax: max0,
  bedrooms: beds0,
  moveIn: move0,
  tenancy: ten0,
}: Readonly<{
  locations: string;
  budgetMin: string;
  budgetMax: string;
  bedrooms: string;
  moveIn: string;
  tenancy: string;
}>) {
  const qc = useQueryClient();
  const [locations, setLocations] = useState(loc0);
  const [budgetMin, setBudgetMin] = useState(min0);
  const [budgetMax, setBudgetMax] = useState(max0);
  const [bedrooms, setBedrooms] = useState(beds0);
  const [moveIn, setMoveIn] = useState(move0);
  const [tenancy, setTenancy] = useState(ten0);

  useEffect(() => {
    setLocations(loc0);
    setBudgetMin(min0);
    setBudgetMax(max0);
    setBedrooms(beds0);
    setMoveIn(move0);
    setTenancy(ten0);
  }, [loc0, min0, max0, beds0, move0, ten0]);

  const savePrefs = useMutation({
    mutationFn: () =>
      updateTenantSearchPrefs({
        data: {
          preferredLocations: locations,
          budgetMin: Number(budgetMin) || 0,
          budgetMax: Number(budgetMax) || 0,
          bedrooms: Number(bedrooms) || 0,
          moveInDate: moveIn,
          previousTenancy: tenancy,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-profile-bundle"] });
      toast.success("Search preferences saved");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form
      className="mt-4 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        savePrefs.mutate();
      }}
    >
      <Field label="Preferred locations">
        <input
          value={locations}
          onChange={(e) => setLocations(e.target.value)}
          placeholder="Kilimani, Lavington"
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Budget min">
          <input
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Budget max">
          <input
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Bedrooms">
          <input
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Move-in date">
          <input
            value={moveIn}
            onChange={(e) => setMoveIn(e.target.value)}
            placeholder="2026-09-01"
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <Field label="Previous tenancy (optional)">
        <textarea
          value={tenancy}
          onChange={(e) => setTenancy(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <button
        type="submit"
        disabled={savePrefs.isPending}
        className="rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-60"
      >
        {savePrefs.isPending ? "Saving…" : "Save search preferences"}
      </button>
    </form>
  );
}

function SharePanel({
  shareUrl,
  percent,
  budgetMin,
  budgetMax,
}: Readonly<{
  shareUrl: string | null;
  percent: number;
  budgetMin: number;
  budgetMax: number;
}>) {
  const qc = useQueryClient();
  const [consentOpen, setConsentOpen] = useState(false);
  const share = useMutation({
    mutationFn: () => createTenantProfileShare(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["tenant-profile-bundle"] });
      const url = `${globalThis.location.origin}${res.path}`;
      void navigator.clipboard?.writeText(url);
      toast.success("Share link copied. Private documents are not included.");
      setConsentOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: () => revokeTenantProfileShare(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-profile-bundle"] });
      toast.success("Profile link revoked");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const low = budgetMin ? formatKes(budgetMin) : "—";
  const high = budgetMax ? formatKes(budgetMax) : "—";
  const budgetLine = budgetMin || budgetMax ? `, budget ${low}–${high}` : "";
  const waText = shareUrl ? `My NyumbaSearch tenant profile: ${shareUrl}` : "";
  const qrSrc = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`
    : "";

  let shareBody: ReactNode;
  if (shareUrl) {
    shareBody = (
      <div className="mt-2 space-y-2">
        <p className="break-all text-xs">{shareUrl}</p>
        <img alt="Profile QR code" className="h-32 w-32 rounded-lg border bg-white p-1" src={qrSrc} />
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(shareUrl)}
          className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-semibold"
        >
          Copy link
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
          className="mr-2 inline-block rounded-lg border px-3 py-1.5 text-xs font-semibold"
        >
          WhatsApp
        </a>
        {typeof navigator.share === "function" ? (
          <button
            type="button"
            onClick={() => void navigator.share({ title: "Tenant profile", url: shareUrl })}
            className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-semibold"
          >
            Share
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => revoke.mutate()}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
        >
          Revoke sharing
        </button>
      </div>
    );
  } else if (consentOpen) {
    shareBody = (
      <div className="mt-2 space-y-2">
        <p className="text-xs">
          Confirm: share name, {percent}% completeness, verification status{budgetLine}. Private
          documents will not be shared.
        </p>
        <button
          type="button"
          disabled={share.isPending}
          onClick={() => share.mutate()}
          className="mr-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Share profile
        </button>
        <button type="button" onClick={() => setConsentOpen(false)} className="text-xs">
          Cancel
        </button>
      </div>
    );
  } else {
    shareBody = (
      <button
        type="button"
        onClick={() => setConsentOpen(true)}
        className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Create share link
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border p-3">
      <p className="text-sm font-semibold">Tenant Profile Card</p>
      <p className="mt-1 text-xs text-muted-foreground">Your verified introduction to landlords.</p>
      <p className="mt-2 text-xs">
        Default visibility is private. Sharing includes name, profile completeness, verification
        badges, budget, preferred locations, and move-in date. ID numbers and documents are never
        included.
      </p>
      {shareBody}
    </div>
  );
}
