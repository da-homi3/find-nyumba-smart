import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAdminPlusCommercial,
  reviewAdminContactIssue,
  saveAdminPlusPricing,
  saveAdminRecommendationWeights,
  saveAdminScoreRule,
} from "@/lib/api/admin.functions";
import { AdminField } from "@/components/admin/admin-shared";
import { errorMessage } from "@/lib/utils";

type ScoreRule = {
  id: string;
  name: string;
  points: number;
  enabled: boolean;
};

type ContactIssue = {
  id: string;
  reason: string;
  status: string;
  listing_id: string;
};

function asScoreRules(raw: unknown): ScoreRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: typeof item.id === "string" ? item.id : "",
      name: typeof item.name === "string" ? item.name : "",
      points: typeof item.points === "number" ? item.points : Number(item.points) || 0,
      enabled: item.enabled !== false,
    };
  });
}

function asContactIssues(raw: unknown): ContactIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: typeof item.id === "string" ? item.id : "",
      reason: typeof item.reason === "string" ? item.reason : "",
      status: typeof item.status === "string" ? item.status : "",
      listing_id: typeof item.listing_id === "string" ? item.listing_id : "",
    };
  });
}

export function AdminPlusCommercialPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-plus-commercial"],
    queryFn: () => getAdminPlusCommercial(),
  });
  const [monthlyKes, setMonthlyKes] = useState("");
  const [quarterlyKes, setQuarterlyKes] = useState("");
  const [quarterlyRegularKes, setQuarterlyRegularKes] = useState("");
  const [credits, setCredits] = useState("");

  useEffect(() => {
    if (!data) return;
    setMonthlyKes(String(data.pricing.monthlyKes));
    setQuarterlyKes(String(data.pricing.quarterlyKes));
    setQuarterlyRegularKes(String(data.pricing.quarterlyRegularKes));
    setCredits(String(data.pricing.contactCreditsPerMonth));
  }, [data]);

  const savePricing = useMutation({
    mutationFn: () =>
      saveAdminPlusPricing({
        data: {
          monthlyKes: Number(monthlyKes),
          quarterlyKes: Number(quarterlyKes),
          quarterlyRegularKes: Number(quarterlyRegularKes),
          contactCreditsPerMonth: Number(credits),
        },
      }),
    onSuccess: () => {
      toast.success("Plus pricing saved");
      void qc.invalidateQueries({ queryKey: ["admin-plus-commercial"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading commercial config…</p>;
  }

  const rules = asScoreRules(data.rules);
  const issues = asContactIssues(data.contactIssues);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Tenant Plus pricing & score rules</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Checkout and M-Pesa amounts use these values. Changing them does not rewrite unlock or AI
          cores.
        </p>
      </div>
      <form
        className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          savePricing.mutate();
        }}
      >
        <AdminField label="Monthly KES">
          <input
            value={monthlyKes}
            onChange={(e) => setMonthlyKes(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="3-month offer KES">
          <input
            value={quarterlyKes}
            onChange={(e) => setQuarterlyKes(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="3-month regular KES">
          <input
            value={quarterlyRegularKes}
            onChange={(e) => setQuarterlyRegularKes(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Contact credits / month">
          <input
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <button
          type="submit"
          disabled={savePricing.isPending}
          className="sm:col-span-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Save pricing
        </button>
      </form>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Tenant Profile Score rules</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {rules.map((rule) => (
            <ScoreRuleRow key={rule.id} rule={rule} />
          ))}
        </ul>
      </div>

      <RecommendationWeightsForm weights={data.recommendationWeights} />

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Contact issue reports</h3>
        {issues.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No reports yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {issues.map((issue) => (
              <ContactIssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ScoreRuleRow({ rule }: Readonly<{ rule: ScoreRule }>) {
  const qc = useQueryClient();
  const [points, setPoints] = useState(String(rule.points));
  const save = useMutation({
    mutationFn: (enabled: boolean) =>
      saveAdminScoreRule({
        data: { id: rule.id, points: Number(points), enabled },
      }),
    onSuccess: () => {
      toast.success("Rule saved");
      void qc.invalidateQueries({ queryKey: ["admin-plus-commercial"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="min-w-40 font-medium">{rule.name}</span>
      <input
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="w-16 rounded-lg border px-2 py-1 text-xs"
      />
      <button type="button" className="text-xs text-primary" onClick={() => save.mutate(rule.enabled)}>
        Save
      </button>
      <button
        type="button"
        className="text-xs text-muted-foreground"
        onClick={() => save.mutate(!rule.enabled)}
      >
        {rule.enabled ? "Disable" : "Enable"}
      </button>
    </li>
  );
}

function RecommendationWeightsForm({
  weights,
}: Readonly<{
  weights?: {
    explorationPercent: number;
    maxPerShelf: number;
    maxPerNeighborhood: number;
    maxPerOwner: number;
    freshnessDays: number;
    minAuthenticity: number;
  };
}>) {
  const qc = useQueryClient();
  const [explorationPercent, setExplorationPercent] = useState(String(weights?.explorationPercent ?? 20));
  const [maxPerShelf, setMaxPerShelf] = useState(String(weights?.maxPerShelf ?? 6));
  const [maxPerNeighborhood, setMaxPerNeighborhood] = useState(String(weights?.maxPerNeighborhood ?? 3));
  const [maxPerOwner, setMaxPerOwner] = useState(String(weights?.maxPerOwner ?? 2));
  const [freshnessDays, setFreshnessDays] = useState(String(weights?.freshnessDays ?? 14));
  const [minAuthenticity, setMinAuthenticity] = useState(String(weights?.minAuthenticity ?? 20));
  const save = useMutation({
    mutationFn: () =>
      saveAdminRecommendationWeights({
        data: {
          explorationPercent: Number(explorationPercent),
          maxPerShelf: Number(maxPerShelf),
          maxPerNeighborhood: Number(maxPerNeighborhood),
          maxPerOwner: Number(maxPerOwner),
          freshnessDays: Number(freshnessDays),
          minAuthenticity: Number(minAuthenticity),
        },
      }),
    onSuccess: () => {
      toast.success("Recommendation settings saved");
      void qc.invalidateQueries({ queryKey: ["admin-plus-commercial"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <form
      className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="sm:col-span-2 text-sm font-semibold">Recommendation engine</h3>
      <p className="sm:col-span-2 text-xs text-muted-foreground">
        Global ranking settings. Individual tenant recommendations cannot be edited without an audit log.
      </p>
      <AdminField label="Exploration %">
        <input value={explorationPercent} onChange={(e) => setExplorationPercent(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </AdminField>
      <AdminField label="Max per shelf">
        <input value={maxPerShelf} onChange={(e) => setMaxPerShelf(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </AdminField>
      <AdminField label="Max per neighborhood">
        <input value={maxPerNeighborhood} onChange={(e) => setMaxPerNeighborhood(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </AdminField>
      <AdminField label="Max per provider">
        <input value={maxPerOwner} onChange={(e) => setMaxPerOwner(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </AdminField>
      <AdminField label="Freshness window (days)">
        <input value={freshnessDays} onChange={(e) => setFreshnessDays(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </AdminField>
      <AdminField label="Min authenticity">
        <input value={minAuthenticity} onChange={(e) => setMinAuthenticity(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </AdminField>
      <button type="submit" disabled={save.isPending} className="sm:col-span-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Save recommendation settings
      </button>
    </form>
  );
}

function ContactIssueRow({ issue }: Readonly<{ issue: ContactIssue }>) {
  const qc = useQueryClient();
  const review = useMutation({
    mutationFn: (status: "reviewed" | "refunded" | "dismissed") =>
      reviewAdminContactIssue({ data: { id: issue.id, status } }),
    onSuccess: () => {
      toast.success("Report updated");
      void qc.invalidateQueries({ queryKey: ["admin-plus-commercial"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <li className="rounded-xl border p-2">
      <p>
        {issue.reason} · {issue.status} · {issue.listing_id.slice(0, 8)}
      </p>
      <div className="mt-1 flex gap-2">
        <button type="button" onClick={() => review.mutate("reviewed")}>
          Reviewed
        </button>
        <button type="button" onClick={() => review.mutate("dismissed")}>
          Dismiss
        </button>
      </div>
    </li>
  );
}
