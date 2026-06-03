import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, MessageSquare, Plus, CheckCircle, ShieldAlert } from "lucide-react";
import { listPropertyReviews, createPropertyReview } from "@/lib/api/reviews.functions";
import { toast } from "sonner";

interface PropertyReviewsSectionProps {
  propertyId: string;
  userId?: string;
  isTenant: boolean;
}

export function PropertyReviewsSection({ propertyId, userId, isTenant }: PropertyReviewsSectionProps) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  // Review metrics state
  const [ratingOverall, setRatingOverall] = useState(5);
  const [water, setWater] = useState(5);
  const [security, setSecurity] = useState(5);
  const [internet, setInternet] = useState(5);
  const [electricity, setElectricity] = useState(5);
  const [cleanliness, setCleanliness] = useState(5);
  const [accessibility, setAccessibility] = useState(5);
  const [comment, setComment] = useState("");

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["property-reviews", propertyId],
    queryFn: () => listPropertyReviews({ data: { propertyId } }),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      await createPropertyReview({
        data: {
          propertyId,
          ratingOverall,
          waterReliability: water,
          securityRating: security,
          internetReliability: internet,
          electricityReliability: electricity,
          cleanliness,
          accessibility,
          comment: comment.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Review submitted successfully!");
      qc.invalidateQueries({ queryKey: ["property-reviews", propertyId] });
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      setShowForm(false);
      // Reset form
      setComment("");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  // Calculate averages
  const count = reviews.length;
  const averages = {
    overall: count ? (reviews.reduce((acc: number, r: any) => acc + Number(r.rating_overall), 0) / count).toFixed(1) : "—",
    water: count ? (reviews.reduce((acc: number, r: any) => acc + r.water_reliability, 0) / count).toFixed(1) : "—",
    security: count ? (reviews.reduce((acc: number, r: any) => acc + r.security_rating, 0) / count).toFixed(1) : "—",
    internet: count ? (reviews.reduce((acc: number, r: any) => acc + r.internet_reliability, 0) / count).toFixed(1) : "—",
    cleanliness: count ? (reviews.reduce((acc: number, r: any) => acc + r.cleanliness, 0) / count).toFixed(1) : "—",
  };

  return (
    <section className="mt-8 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Tenant Reviews ({count})
        </h2>
        {isTenant && !showForm && (
          <button
            onClick={() => {
              if (!userId) {
                toast.error("Please sign in to leave a review");
                return;
              }
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" /> Write a review
          </button>
        )}
      </div>

      {/* Overview stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-5">
        <div className="text-center sm:border-r">
          <div className="font-display text-3xl font-bold text-primary">{averages.overall}</div>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mt-1">Overall</div>
        </div>
        <div className="text-center sm:border-r">
          <div className="text-sm font-semibold">{averages.water} / 5</div>
          <div className="text-[10px] text-muted-foreground mt-1">Water</div>
        </div>
        <div className="text-center sm:border-r">
          <div className="text-sm font-semibold">{averages.security} / 5</div>
          <div className="text-[10px] text-muted-foreground mt-1">Security</div>
        </div>
        <div className="text-center sm:border-r">
          <div className="text-sm font-semibold">{averages.internet} / 5</div>
          <div className="text-[10px] text-muted-foreground mt-1">Internet</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold">{averages.cleanliness} / 5</div>
          <div className="text-[10px] text-muted-foreground mt-1">Cleanliness</div>
        </div>
      </div>

      {/* Review Submission Form */}
      {showForm && (
        <div className="mt-6 rounded-2xl border bg-card p-5 animate-in fade-in duration-200">
          <h3 className="font-display text-sm font-semibold">Share your rental experience</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: "Overall Rating", val: ratingOverall, set: setRatingOverall },
              { label: "Water Reliability", val: water, set: setWater },
              { label: "Security & Safety", val: security, set: setSecurity },
              { label: "Internet Speed/Quality", val: internet, set: setInternet },
              { label: "Electricity Reliability", val: electricity, set: setElectricity },
              { label: "Cleanliness", val: cleanliness, set: setCleanliness },
              { label: "Accessibility", val: accessibility, set: setAccessibility },
            ].map((metric) => (
              <div key={metric.label} className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-medium">{metric.label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => metric.set(star)}
                      className="p-0.5 hover:scale-110"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          star <= metric.val ? "fill-gold text-gold" : "text-muted-foreground/35"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <label className="block mt-4">
            <span className="text-xs font-semibold">Review details</span>
            <textarea
              placeholder="Tell other tenants about water supply, safety, noise, or landlord behavior..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => submitReview.mutate()}
              disabled={submitReview.isPending}
              className="rounded-xl bg-gradient-emerald px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-70"
            >
              {submitReview.isPending ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            No reviews yet. Be the first to share an experience!
          </div>
        ) : (
          reviews.map((r: any) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center font-bold text-xs text-secondary-foreground">
                    {r.profiles?.avatar_url ? (
                      <img src={r.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (r.profiles?.full_name ?? "T").charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold">{r.profiles?.full_name ?? "Anonymous Tenant"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <Star className="h-3 w-3 fill-current" /> {r.rating_overall}
                </div>
              </div>
              {r.comment && <p className="mt-3 text-xs leading-relaxed text-foreground/80">{r.comment}</p>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
