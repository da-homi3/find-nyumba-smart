import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BedDouble,
  Bath,
  Square,
  MapPin,
  ShieldCheck,
  Phone,
  MessageCircle,
  Heart,
  Share2,
  Calendar,
} from "lucide-react";
import { fetchProperty, formatKes, prettyType } from "@/lib/properties";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createInquiry,
  listSavedProperties,
  toggleSavedProperty,
} from "@/lib/api/nyumba.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/property/$id")({
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = useParams({ from: "/tenant/property/$id" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: p, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id),
  });

  const { data: isSaved } = useQuery({
    queryKey: ["saved", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const saved = await listSavedProperties();
      return saved.some((property) => property.id === id);
    },
  });

  const { data: landlordProfile } = useQuery({
    queryKey: ["landlord-profile", p?.owner_id, user?.id],
    enabled: !!p?.owner_id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("phone, full_name")
        .eq("id", p!.owner_id!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save properties");
      await toggleSavedProperty({ data: { propertyId: id, saved: !isSaved } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved"] });
      toast.success(isSaved ? "Removed from saved" : "Saved to your list");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messageLandlord = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to message landlords");
      if (!p?.owner_id) throw new Error("Landlord contact is unavailable for this listing");

      await createInquiry({
        data: {
          propertyId: id,
          message: `Hi, I'm interested in ${p.title}. Is it still available?`,
        },
      });
    },
    onSuccess: () => toast.success("Message sent to the landlord"),
    onError: (e: Error) => {
      if (e.message.includes("Sign in")) {
        toast.error(e.message);
        navigate({ to: "/auth" });
        return;
      }

      toast.error(e.message);
    },
  });

  const handleCall = () => {
    const phone = landlordProfile?.phone?.trim();

    if (!phone) {
      toast.info("Phone contact is not available yet. Try sending a message.");
      return;
    }

    window.location.href = `tel:${phone}`;
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: p?.title ?? "NyumbaSearch listing", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Listing link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this listing");
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!p) return <div className="p-6">Property not found.</div>;

  return (
    <div className="pb-32">
      {/* Gallery */}
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {p.images[0] && (
            <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
          )}
        </div>
        <Link
          to="/tenant"
          className="absolute top-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-background/95 shadow-soft backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share listing"
            className="grid h-10 w-10 place-items-center rounded-full bg-background/95 shadow-soft backdrop-blur"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => toggleSave.mutate()}
            aria-label={isSaved ? "Remove from saved homes" : "Save home"}
            className="grid h-10 w-10 place-items-center rounded-full bg-background/95 shadow-soft backdrop-blur"
          >
            <Heart className={`h-4 w-4 ${isSaved ? "fill-destructive text-destructive" : ""}`} />
          </button>
        </div>
        {p.is_verified && (
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            <ShieldCheck className="h-3 w-3" /> Verified listing
          </span>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight">{p.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {p.neighborhood}
              {p.address ? ` · ${p.address}` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-semibold text-primary">
              {formatKes(p.rent_kes)}
            </div>
            <div className="text-xs text-muted-foreground">/month</div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border bg-card p-3">
          <Stat icon={BedDouble} label="Beds" value={String(p.bedrooms)} />
          <Stat icon={Bath} label="Baths" value={String(p.bathrooms)} />
          <Stat icon={Square} label="Area" value={p.area_sqm ? `${p.area_sqm}m²` : "—"} />
          <Stat
            icon={Calendar}
            label="Move-in"
            value={p.available_from ? new Date(p.available_from).toLocaleDateString() : "Now"}
          />
        </div>

        <div className="mt-5 rounded-2xl bg-secondary px-4 py-3 text-sm">
          <span className="font-medium">Type:</span> {prettyType(p.property_type)} ·{" "}
          <span className="font-medium">Deposit:</span>{" "}
          {p.deposit_kes ? formatKes(p.deposit_kes) : "—"}
        </div>

        {/* Description */}
        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold">About this home</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
        </section>

        {/* Amenities */}
        {p.amenities.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display text-lg font-semibold">Amenities</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium"
                >
                  {a}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Neighborhood intel */}
        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold">Neighborhood intel</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { label: "Water reliability", score: 4 },
              { label: "Security", score: 5 },
              { label: "Noise", score: 3 },
              { label: "Internet", score: 5 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-3">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={`h-2 w-6 rounded-full ${i <= s.score ? "bg-gradient-emerald" : "bg-muted"}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Action bar */}
      <div className="fixed bottom-16 inset-x-0 z-20 border-t bg-background/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            type="button"
            onClick={handleCall}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            <Phone className="h-4 w-4" /> Call
          </button>
          <button
            type="button"
            onClick={() => messageLandlord.mutate()}
            disabled={messageLandlord.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-4 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-70"
          >
            <MessageCircle className="h-4 w-4" /> Message landlord
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <div className="mt-1 text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
