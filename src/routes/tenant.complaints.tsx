import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, MessageSquareWarning, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { FileDropZone } from "@/components/FileDropZone";
import { useAuth } from "@/hooks/use-auth";
import { createPmComplaint, listMyPmComplaints } from "@/lib/api/pm-complaints.functions";
import { MAX_COMPLAINT_PHOTO_MB, uploadComplaintPhoto } from "@/lib/media/upload-complaint-photo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenant/complaints")({
  head: () => ({ meta: [{ title: "Complaints — NyumbaSearch" }] }),
  component: TenantComplaintsPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Submitted",
  seen: "Seen by landlord",
  replied: "Landlord replied",
  closed: "Closed",
};

function TenantComplaintsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list" | "new">("list");

  const listQ = useQuery({
    queryKey: ["tenant-complaints", user?.id],
    enabled: Boolean(user),
    queryFn: () => listMyPmComplaints(),
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="font-display text-2xl font-semibold">Complaints</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in after accepting a landlord invite to file complaints.
        </p>
        <Link to="/auth" className="mt-4 inline-block text-sm font-semibold text-primary">
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Complaints</h1>
        </div>
        <button
          type="button"
          className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          onClick={() => setMode(mode === "list" ? "new" : "list")}
        >
          {mode === "list" ? "New complaint" : "Back to list"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell your landlord about an issue. Optionally attach a photo.{" "}
        <Link to="/tenant/maintenance" className="font-semibold text-primary">
          Maintenance →
        </Link>
      </p>

      {mode === "new" ? (
        <ComplaintForm
          userId={user.id}
          onDone={() => {
            setMode("list");
            qc.invalidateQueries({ queryKey: ["tenant-complaints"] });
          }}
        />
      ) : (
        <ComplaintList loading={listQ.isLoading} items={listQ.data ?? []} />
      )}
    </div>
  );
}

function ComplaintList({
  loading,
  items,
}: Readonly<{
  loading: boolean;
  items: Awaited<ReturnType<typeof listMyPmComplaints>>;
}>) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No complaints yet.
      </p>
    );
  }
  return (
    <ul className="mt-6 space-y-3">
      {items.map((c) => (
        <li key={c.id} className="rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{c.subject}</p>
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              {STATUS_LABEL[c.status] ?? c.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.property_name}
            {c.unit_label ? ` · Unit ${c.unit_label}` : ""} ·{" "}
            {new Date(c.created_at).toLocaleDateString()}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
          {c.photo_url ? (
            <img
              src={c.photo_url}
              alt=""
              className="mt-3 max-h-48 w-full rounded-lg object-cover"
            />
          ) : null}
          {c.landlord_reply ? (
            <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-primary">Landlord reply</p>
              <p className="mt-1 whitespace-pre-wrap">{c.landlord_reply}</p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function friendlyServerError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Something went wrong";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return raw;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return raw;
    const first = parsed[0] as { message?: string; path?: string[] };
    if (typeof first.message !== "string" || first.message.length === 0) return raw;
    const field = first.path?.[0];
    if (field === "body") return "Please describe the issue in a bit more detail.";
    if (field === "subject") return "Please enter a short subject.";
    return first.message;
  } catch {
    return raw;
  }
}

function ComplaintForm({ userId, onDone }: Readonly<{ userId: string; onDone: () => void }>) {
  const subjectId = useId();
  const bodyId = useId();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const subjectOk = subject.trim().length >= 3;
  const bodyOk = body.trim().length >= 5;

  const submit = useMutation({
    mutationFn: async () => {
      if (subject.trim().length < 3) {
        throw new Error("Please enter a short subject (at least 3 characters).");
      }
      if (body.trim().length < 5) {
        throw new Error("Please describe the issue in a bit more detail (at least 5 characters).");
      }
      let photoUrl: string | null = null;
      if (file) {
        photoUrl = await uploadComplaintPhoto(userId, file);
      }
      return createPmComplaint({
        data: {
          subject: subject.trim(),
          body: body.trim(),
          photoUrl,
        },
      });
    },
    onSuccess: () => {
      toast.success("Complaint sent — your landlord was notified");
      onDone();
    },
    onError: (e: Error) => toast.error(friendlyServerError(e)),
  });

  const busy = submit.isPending;
  const submitEnabled = subjectOk && bodyOk && !busy;

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!subjectOk) {
          toast.error("Please enter a short subject (at least 3 characters).");
          return;
        }
        if (!bodyOk) {
          toast.error("Please describe the issue in a bit more detail (at least 5 characters).");
          return;
        }
        submit.mutate();
      }}
    >
      <label className="block text-xs" htmlFor={subjectId}>
        <span className="font-medium">Subject</span>
        <input
          id={subjectId}
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          minLength={3}
          placeholder="e.g. Noise from upstairs"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-base"
        />
      </label>
      <label className="block text-xs" htmlFor={bodyId}>
        <span className="font-medium">Details</span>
        <textarea
          id={bodyId}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={4000}
          minLength={5}
          placeholder="Describe the issue…"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-base"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          At least 5 characters. Your landlord gets an email and an in-app notification.
        </span>
      </label>

      <div>
        <p className="mb-1.5 text-xs font-medium">Photo (optional)</p>
        {preview ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            <img src={preview} alt="" className="max-h-48 w-full object-cover" />
            <button
              type="button"
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1"
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <FileDropZone
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple={false}
            title="Add a photo (optional)"
            hint={`Max ${MAX_COMPLAINT_PHOTO_MB}MB`}
            icon={<ImageIcon className="h-8 w-8 text-primary" />}
            onFiles={(files) => {
              const f = files[0];
              if (!f) return;
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }}
          />
        )}
      </div>

      <button
        type="submit"
        disabled={!submitEnabled}
        className={cn(
          "w-full rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60",
        )}
      >
        {busy ? "Sending…" : "Send to landlord"}
      </button>
    </form>
  );
}
