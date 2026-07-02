import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { sendAdminAnnouncement } from "@/lib/api/admin.functions";
import { getSiteUrl } from "@/lib/site";

const ROLE_OPTIONS = [
  { id: "all", label: "All users" },
  { id: "tenant", label: "Tenants" },
  { id: "landlord", label: "Landlords" },
  { id: "agency", label: "Agencies" },
  { id: "manager", label: "Property managers" },
] as const;

export function AdminAnnouncementsTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Learn more");
  const [ctaUrl, setCtaUrl] = useState(getSiteUrl());
  const [targetRoles, setTargetRoles] = useState<Array<(typeof ROLE_OPTIONS)[number]["id"]>>([
    "all",
  ]);

  const send = useMutation({
    mutationFn: () =>
      sendAdminAnnouncement({
        data: { title, body, ctaLabel, ctaUrl, targetRoles },
      }),
    onSuccess: (res) => {
      toast.success(`Announcement sent to ${res.sent} users (${res.skipped} skipped)`);
      setTitle("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = (id: (typeof ROLE_OPTIONS)[number]["id"]) => {
    if (id === "all") {
      setTargetRoles(["all"]);
      return;
    }
    setTargetRoles((prev) => {
      const withoutAll = prev.filter((r) => r !== "all");
      if (withoutAll.includes(id)) {
        const next = withoutAll.filter((r) => r !== id);
        return next.length ? next : ["all"];
      }
      return [...withoutAll, id];
    });
  };

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Send a product update email to opted-in users. Transactional emails are unaffected.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border bg-card px-3 py-2"
          placeholder="WhatsApp bot is live"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full rounded-xl border bg-card px-3 py-2"
          placeholder="Plain English description of what changed…"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">CTA label</span>
          <input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="w-full rounded-xl border bg-card px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">CTA URL</span>
          <input
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className="w-full rounded-xl border bg-card px-3 py-2"
          />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Audience</legend>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleRole(r.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                targetRoles.includes(r.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        disabled={send.isPending || !title.trim() || !body.trim()}
        onClick={() => send.mutate()}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {send.isPending ? "Sending…" : "Send announcement"}
      </button>
    </div>
  );
}
