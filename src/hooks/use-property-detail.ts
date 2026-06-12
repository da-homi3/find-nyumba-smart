import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { fetchProperty, searchProperties } from "@/lib/properties";
import { getAIChatResponse, getAIValuation } from "@/lib/api/ai.functions";
import {
  createInquiry,
  getPropertyOwnerContact,
  listSavedProperties,
  toggleSavedProperty,
} from "@/lib/api/nyumba.functions";
import { recordTenantLead } from "@/lib/api/revenue.functions";
import { reportScam } from "@/lib/api/trust.functions";
import { isDemoListingId } from "@/data/mockListings";
import { useAuth } from "@/hooks/use-auth";
import { pushRecentlyViewed } from "@/lib/recently-viewed";
import { currentRedirectPath } from "@/lib/navigation";
import type { Property } from "@/lib/properties";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

export function usePropertyDetail(id: string, initialProperty?: Property | null) {
  const navigate = useNavigate();
  const location = useLocation();
  const authSearch = { redirect: currentRedirectPath(location) };
  const { user } = useAuth();
  const qc = useQueryClient();

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Habari! I am your NyumbaSearch AI Assistant. Ask me anything about this property, the location, or security.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Suspicious listing");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    if (!user || isDemoListingId(id)) return;
    const timer = globalThis.setTimeout(() => {
      void recordTenantLead({ data: { listingId: id, source: "view" } });
    }, 30_000);
    return () => globalThis.clearTimeout(timer);
  }, [user, id]);

  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id),
    initialData: initialProperty ?? undefined,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!p) return;
    pushRecentlyViewed({
      id: p.id,
      title: p.title,
      neighborhood: p.neighborhood,
      rent_kes: p.rent_kes,
      images: p.images,
      property_type: p.property_type,
    });
  }, [p]);

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

  const handleSendChat = async (e: FormEvent<HTMLFormElement>) => {
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
    } catch {
      toast.error("AI assistant offline. Please try again.");
    } finally {
      setChatLoading(false);
    }
  };

  const openReportForm = () => {
    if (!user) {
      toast.error("Sign in to report a listing");
      navigate({ to: "/auth", search: authSearch });
      return;
    }
    if (isDemoListingId(id)) {
      toast.info("Demo listings are sample data — nothing to report.");
      return;
    }
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!reportReason.trim()) {
      toast.error("Please provide a reason for your report.");
      return;
    }
    setReportSubmitting(true);
    try {
      const result = await reportScam({
        data: {
          propertyId: id,
          reason: reportReason.trim(),
          details: reportDetails.trim() || undefined,
        },
      });
      toast.success(
        result.autoFlagged
          ? "Report submitted. This listing was flagged for review."
          : "Thanks — our team will review your report.",
      );
      setReportOpen(false);
      setReportDetails("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit report");
    } finally {
      setReportSubmitting(false);
    }
  };

  const openBooking = () => {
    if (!user) {
      toast.error("Please sign in to book viewings");
      navigate({ to: "/auth", search: authSearch });
      return;
    }
    if (isDemoListingId(id)) {
      toast.info("Demo listings cannot be booked. Find a live listing to schedule a viewing.");
      return;
    }
    setIsBookingOpen(true);
  };

  return {
    user,
    p,
    isLoading,
    isError,
    refetch,
    isSaved,
    similar,
    landlordContact,
    valuation,
    valLoading,
    isBookingOpen,
    setIsBookingOpen,
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    galleryIndex,
    setGalleryIndex,
    reportOpen,
    setReportOpen,
    reportReason,
    setReportReason,
    reportDetails,
    setReportDetails,
    reportSubmitting,
    toggleSave,
    messageLandlord,
    handleCall,
    handleShare,
    handleSendChat,
    openReportForm,
    submitReport,
    openBooking,
    isDemo: isDemoListingId(id),
  };
}
