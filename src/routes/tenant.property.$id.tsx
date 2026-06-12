import { createFileRoute, Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  Flame,
  Sparkles,
  Bot,
  Send,
  Flag,
} from "lucide-react";
import { fetchProperty, formatKes, prettyType, searchProperties } from "@/lib/properties";
import { getListingIntel, verificationLevel } from "@/lib/listing-intel";
import { PropertyIntelligencePanel } from "@/components/PropertyIntelligencePanel";
import { PropertyCard } from "@/components/PropertyCard";
import { useAuth } from "@/hooks/use-auth";
import {
  createInquiry,
  listSavedProperties,
  toggleSavedProperty,
  getPropertyOwnerContact,
} from "@/lib/api/nyumba.functions";
import { getAIValuation, getAIChatResponse } from "@/lib/api/ai.functions";
import { VerificationBadge } from "@/components/VerificationBadge";
import { BookingModal } from "@/components/BookingModal";
import { PropertyReviewsSection } from "@/components/PropertyReviewsSection";
import { isDemoListingId } from "@/data/mockListings";
import { reportScam } from "@/lib/api/trust.functions";
import { toast } from "sonner";
import { useEntitlements } from "@/hooks/use-entitlements";
import { recordTenantLead } from "@/lib/api/revenue.functions";
import { PropertyRevenueBlocks } from "@/components/PropertyRevenueBlocks";

export const Route = createFileRoute("/tenant/property/$id")({
  loader: async ({ params }) => {
    const p = await fetchProperty(params.id);
    return { property: p };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.property;
    if (!p) {
      return { meta: [{ title: "Property — NyumbaSearch" }] };
    }
    const title = `${p.title} — ${p.neighborhood} | NyumbaSearch`;
    const description =
      p.description?.slice(0, 160) ??
      `${prettyType(p.property_type)} in ${p.neighborhood} from ${formatKes(p.rent_kes)}/mo`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Apartment",
      name: p.title,
      description,
      address: { "@type": "PostalAddress", addressLocality: p.neighborhood, addressCountry: "KE" },
      geo:
        p.latitude && p.longitude
          ? { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude }
          : undefined,
      offers: {
        "@type": "Offer",
        price: p.rent_kes,
        priceCurrency: "KES",
        availability: "https://schema.org/InStock",
      },
      image: p.images[0],
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        ...(p.images[0] ? [{ property: "og:image", content: p.images[0] }] : []),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = useParams({ from: "/tenant/property/$id" });
  const navigate = useNavigate();
  const location = useLocation();
  const authSearch = { redirect: location.pathname + location.search };
  const { user } = useAuth();
  const { isPlus } = useEntitlements();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user || isDemoListingId(id)) return;
    const timer = window.setTimeout(() => {
      void recordTenantLead({ data: { listingId: id, source: "view" } });
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [user, id]);

  // Booking & Chat States
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { id: string; role: "user" | "assistant"; text: string }[]
  >([
    {
      id: "welcome",
      role: "assistant",
      text: "Habari! I am your NyumbaSearch AI Assistant. Ask me anything about this property, the location, or security.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

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

  const { data: similar = [] } = useQuery({
    queryKey: ["similar", id, p?.neighborhood],
    enabled: !!p,
    queryFn: async () => {
      const result = await searchProperties({ neighborhood: p!.neighborhood, limit: 4 });
      return result.items.filter((item) => item.id !== id).slice(0, 3);
    },
  });

  const { data: landlordContact } = useQuery({
    queryKey: ["landlord-contact", p?.owner_id, id, user?.id],
    enabled: !!p?.owner_id && !!user && !isDemoListingId(id),
    queryFn: () => getPropertyOwnerContact({ data: { propertyId: id } }),
  });

  // AI Valuation query
  const { data: valuation, isLoading: valLoading } = useQuery({
    queryKey: ["valuation", id],
    queryFn: () => getAIValuation({ data: { propertyId: id } }),
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save properties");
      if (isDemoListingId(id)) {
        throw new Error("Demo listings cannot be saved. Browse live listings from landlords.");
      }
      await toggleSavedProperty({ data: { propertyId: id, saved: !isSaved } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved"] });
      toast.success(isSaved ? "Removed from saved" : "Saved to your list");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      if (e.message.includes("Sign in")) navigate({ to: "/auth", search: authSearch });
    },
  });

  const messageLandlord = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to message landlords");
      if (isDemoListingId(id)) {
        throw new Error("Demo listings cannot be messaged. Try a live landlord listing.");
      }
      if (!p?.owner_id) throw new Error("Landlord contact is unavailable for this listing");

      return createInquiry({
        data: {
          propertyId: id,
          message: `Hi, I'm interested in ${p.title}. Is it still available?`,
        },
      });
    },
    onSuccess: (inquiry) => {
      toast.success("Message sent to the landlord");
      navigate({ to: "/tenant/messages/$id", params: { id: inquiry.id } });
    },
    onError: (e: Error) => {
      if (e.message.includes("Sign in")) {
        toast.error(e.message);
        navigate({ to: "/auth", search: authSearch });
        return;
      }
      toast.error(e.message);
    },
  });

  const handleCall = () => {
    if (!user) {
      toast.error("Sign in to call the landlord");
      navigate({ to: "/auth", search: authSearch });
      return;
    }
    const phone = landlordContact?.phone?.trim();
    if (!phone) {
      toast.info("Phone not on file — send a message to reach the landlord.");
      return;
    }
    globalThis.location.href = `tel:${phone}`;
  };

  const handleShare = async () => {
    const shareUrl = globalThis.location.href;
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

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await getAIChatResponse({ data: { message: userMsg, propertyId: id } });
      setChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: response },
      ]);
    } catch (err) {
      toast.error("AI assistant offline. Please try again.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleReportScam = async () => {
    if (!user) {
      toast.error("Sign in to report a listing");
      navigate({ to: "/auth", search: authSearch });
      return;
    }
    if (isDemoListingId(id)) {
      toast.info("Demo listings are sample data — nothing to report.");
      return;
    }
    const reason = globalThis.prompt("Why are you reporting this listing?", "Suspicious listing");
    if (!reason?.trim()) return;
    const details = globalThis.prompt("Any extra details? (optional)") ?? undefined;
    try {
      const result = await reportScam({
        data: { propertyId: id, reason: reason.trim(), details: details?.trim() || undefined },
      });
      toast.success(
        result.autoFlagged
          ? "Report submitted. This listing was flagged for review."
          : "Thanks — our team will review your report.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit report");
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!p) return <div className="p-6">Property not found.</div>;

  const score = p.authenticity_score ?? 70;
  const vLevel = verificationLevel(p);
  const intel = getListingIntel(p);
  const gallery = p.images.length > 0 ? p.images : [];
  const activeImage = gallery[galleryIndex] ?? gallery[0];
  const isDemo = isDemoListingId(id);

  return (
    <div className="pb-32 bg-background min-h-screen">
      {isDemo && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-center text-xs text-amber-900 dark:text-amber-200">
          Demo listing — browse photos and AI tools here. Save, message, and book viewings on live
          listings from verified landlords.
        </div>
      )}
      {/* Gallery */}
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted max-h-[500px]">
          {activeImage ? (
            <img src={activeImage} alt={p.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              No image available
            </div>
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
        {gallery.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {gallery.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setGalleryIndex(i)}
                aria-label={`Photo ${i + 1}`}
                className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${i === galleryIndex ? "border-primary" : "border-white/80"}`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          {vLevel > 0 && <VerificationBadge level={vLevel} />}
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-orange-400" /> Authenticity Score: {score}%
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight">{p.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {p.neighborhood} · {intel.subArea}
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

        <div className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-sm">
          <span className="font-medium">Type:</span> {prettyType(p.property_type)} ·{" "}
          <span className="font-medium">Deposit:</span>{" "}
          {p.deposit_kes ? formatKes(p.deposit_kes) : "—"}
          {intel.parking ? " · Parking" : ""}
        </div>

        <PropertyIntelligencePanel intel={intel} />

        <section className="mt-6 rounded-2xl border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">About this landlord</h2>
          <div className="mt-3 flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
              {(landlordContact?.fullName ?? "L").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 text-sm">
              <p className="font-semibold">{landlordContact?.fullName ?? "Verified landlord"}</p>
              {vLevel > 0 && (
                <div className="mt-1">
                  <VerificationBadge level={vLevel} />
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Phone verified · Usually replies within 2 hours
              </p>
            </div>
          </div>
        </section>

        {/* AI Valuation Widget */}
        <section className="mt-6 rounded-2xl border bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4">
          <h3 className="font-display text-sm font-semibold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
            AI Valuation Estimate
          </h3>
          {valLoading ? (
            <p className="text-xs text-muted-foreground mt-1">Calculating fair market rent...</p>
          ) : valuation ? (
            <div className="mt-2 text-xs">
              <div className="flex justify-between items-center">
                <span>
                  Estimated rent range:{" "}
                  <strong className="text-foreground">{valuation.estimatedRentRange}</strong>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    valuation.valuationGrade === "Good Deal"
                      ? "bg-emerald-500/20 text-emerald-700"
                      : valuation.valuationGrade === "Overpriced"
                        ? "bg-red-500/20 text-red-700"
                        : "bg-gray-500/20 text-gray-700"
                  }`}
                >
                  {valuation.valuationGrade}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground leading-relaxed">{valuation.details}</p>
            </div>
          ) : null}
        </section>

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

        {/* AI Chat Assistant Widget */}
        <section className="mt-6 rounded-2xl border bg-card p-4 shadow-soft">
          <h3 className="font-display text-sm font-semibold flex items-center gap-1.5">
            <Bot className="h-4.5 w-4.5 text-primary" />
            Ask the AI Assistant
          </h3>
          <div className="mt-3 max-h-48 overflow-y-auto space-y-2 border-b pb-3 text-xs">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && <div className="text-muted-foreground italic">AI is typing...</div>}
          </div>
          <form onSubmit={handleSendChat} className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Ask about water supply, safety, noise..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-95"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>

        <PropertyRevenueBlocks property={p} isPlus={isPlus} />

        {/* Reviews & Neighborhood Quality Ratings */}
        <PropertyReviewsSection propertyId={id} userId={user?.id} isTenant={!!user} />

        {!isDemo && (
          <button
            type="button"
            onClick={() => void handleReportScam()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/5"
          >
            <Flag className="h-3.5 w-3.5" />
            Report suspicious listing
          </button>
        )}

        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">Similar homes nearby</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {similar.map((item) => (
                <PropertyCard key={item.id} p={item} showSave={false} />
              ))}
            </div>
          </section>
        )}
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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            <MessageCircle className="h-4 w-4" /> Message
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                toast.error("Please sign in to book viewings");
                navigate({ to: "/auth", search: authSearch });
                return;
              }
              if (isDemo) {
                toast.info(
                  "Demo listings cannot be booked. Find a live listing to schedule a viewing.",
                );
                return;
              }
              setIsBookingOpen(true);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-4 py-3 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95"
          >
            <Calendar className="h-4 w-4" /> Book viewing
          </button>
        </div>
      </div>

      {/* Viewing schedule modal */}
      {p.owner_id && (
        <BookingModal
          propertyId={p.id}
          landlordId={p.owner_id}
          propertyTitle={p.title}
          propertyAddress={p.address ?? p.neighborhood}
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: Readonly<{
  icon: typeof BedDouble;
  label: string;
  value: string;
}>) {
  return (
    <div className="text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <div className="mt-1 text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
