import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  listPmComplaints,
  markPmComplaintSeen,
  replyToPmComplaint,
} from "@/lib/api/pm-complaints.functions";
import { PmPropertySubnav, type PmPortal } from "@/components/pm/pm-nav";
import { cn } from "@/lib/utils";

type ComplaintRow = Awaited<ReturnType<typeof listPmComplaints>>["complaints"][number];

const STATUS_LABEL: Record<string, string> = {
  open: "New",
  seen: "Seen",
  replied: "Replied",
  closed: "Closed",
};

export function PmComplaintsPage({
  portal,
  propertyId,
}: Readonly<{ portal: PmPortal; propertyId: string }>) {
  const qc = useQueryClient();
  const [replyFor, setReplyFor] = useState<ComplaintRow | null>(null);
  const [replyText, setReplyText] = useState("");

  const listQ = useQuery({
    queryKey: ["pm-complaints", propertyId],
    queryFn: () => listPmComplaints({ data: { propertyId } }),
  });

  const seenMut = useMutation({
    mutationFn: (complaintId: string) => markPmComplaintSeen({ data: { complaintId } }),
    onSuccess: () => {
      toast.success("Marked as seen");
      qc.invalidateQueries({ queryKey: ["pm-complaints", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyMut = useMutation({
    mutationFn: () => {
      if (!replyFor) throw new Error("No complaint selected");
      return replyToPmComplaint({
        data: { complaintId: replyFor.id, reply: replyText.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Reply sent to tenant");
      setReplyFor(null);
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["pm-complaints", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const complaints = listQ.data?.complaints ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-2">
        <MessageSquareWarning className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-semibold">Complaints</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Tenant complaints with optional photos. Mark as seen and reply with a custom message.
      </p>
      <div className="mt-6">
        <PmPropertySubnav portal={portal} propertyId={propertyId} active="complaints" />
      </div>

      {listQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!listQ.isLoading && complaints.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No complaints yet.
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {complaints.map((c) => (
          <li
            key={c.id}
            className={cn(
              "rounded-xl border border-border p-4",
              c.status === "open" && "border-amber-500/50 bg-amber-500/5",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{c.subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.tenant_name ?? "Tenant"}
                  {c.unit_label ? ` · Unit ${c.unit_label}` : ""} ·{" "}
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{c.body}</p>
            {c.photo_url ? (
              <a
                href={c.photo_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block overflow-hidden rounded-lg border border-border"
              >
                <img
                  src={c.photo_url}
                  alt="Complaint attachment"
                  className="max-h-56 w-full object-cover"
                />
              </a>
            ) : null}
            {c.landlord_reply ? (
              <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">Your reply</p>
                <p className="mt-1 whitespace-pre-wrap">{c.landlord_reply}</p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status === "open" ? (
                <button
                  type="button"
                  disabled={seenMut.isPending}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                  onClick={() => seenMut.mutate(c.id)}
                >
                  Mark as seen
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                onClick={() => {
                  setReplyFor(c);
                  setReplyText(c.landlord_reply ?? "");
                }}
              >
                {c.landlord_reply ? "Update reply" : "Reply"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {replyFor ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl">
            <h2 className="text-sm font-semibold">Reply to: {replyFor.subject}</h2>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
              placeholder="Write a custom message to the tenant…"
              className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold"
                onClick={() => {
                  setReplyFor(null);
                  setReplyText("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={replyMut.isPending || !replyText.trim()}
                className="flex-1 rounded-lg bg-foreground py-2 text-sm font-semibold text-background disabled:opacity-60"
                onClick={() => replyMut.mutate()}
              >
                {replyMut.isPending ? "Sending…" : "Send reply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
