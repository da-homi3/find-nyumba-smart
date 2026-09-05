import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  listPlatformReviews,
  submitPlatformReview,
  type PlatformReviewPublic,
} from "@/lib/api/platform-reviews.functions";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/utils";

function Stars({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: Readonly<{
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}>) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex items-center gap-1" role={readOnly ? "img" : "group"} aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        if (readOnly) {
          return (
            <Star
              key={n}
              className={`${dim} ${filled ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
              aria-hidden
            />
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="rounded p-0.5 hover:opacity-90"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={filled}
          >
            <Star
              className={`${dim} ${filled ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

function ReviewCard({ review }: Readonly<{ review: PlatformReviewPublic }>) {
  return (
    <article className="rounded-2xl border bg-card/80 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{review.displayName}</p>
        <Stars value={review.rating} readOnly size="sm" />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
    </article>
  );
}

export function SiteReviewsSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const metaName =
      typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    if (metaName && !displayName) {
      setDisplayName(metaName);
    }
  }, [user?.user_metadata?.full_name, displayName]);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["platform-reviews"],
    queryFn: () => listPlatformReviews(),
    staleTime: 60_000,
  });

  const submit = useMutation({
    mutationFn: () =>
      submitPlatformReview({
        data: { displayName, rating, comment },
      }),
    onSuccess: (row) => {
      toast.success("Thanks for your review!");
      setComment("");
      setRating(5);
      qc.setQueryData<PlatformReviewPublic[]>(["platform-reviews"], (prev) => [
        row,
        ...(prev ?? []).filter((r) => r.id !== row.id),
      ]);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <section
      id="site-reviews"
      className="border-t border-border/70 bg-background"
      aria-labelledby="site-reviews-heading"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Reviews</p>
          <h2 id="site-reviews-heading" className="mt-2 font-display text-2xl font-semibold">
            How was your experience?
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Tell others what finding or listing a home on NyumbaSearch was like. Honest feedback
            helps us keep Nairobi renting trustworthy.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <div>
              <span className="text-sm font-medium">Your rating</span>
              <div className="mt-1.5">
                <Stars value={rating} onChange={setRating} />
              </div>
            </div>
            <label className="block text-sm font-medium">
              <span>Display name</span>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                placeholder={user ? "Your name" : "First name or initials"}
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              <span>Your review</span>
              <textarea
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                minLength={10}
                maxLength={800}
                rows={4}
                placeholder="What worked well? What should we improve?"
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={submit.isPending}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
            >
              {submit.isPending ? "Sending…" : "Submit review"}
            </button>
          </form>
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold">Recent reviews</h3>
          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading reviews…</p>
          ) : reviews.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              Be the first to leave a review — your note appears here after you submit.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {reviews.slice(0, 6).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
