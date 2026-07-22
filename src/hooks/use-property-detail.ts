import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { fetchProperty, searchProperties } from "@/lib/properties";
import { getAIValuation } from "@/lib/api/ai.functions";
import {
  createInquiry,
  getPropertyOwnerContact,
  listSavedProperties,
  toggleSavedProperty,
} from "@/lib/api/nyumba.functions";
import { recordTenantLead } from "@/lib/api/revenue.functions";
import { reportScam } from "@/lib/api/trust.functions";
import { useAuth } from "@/hooks/use-auth";
import { pushRecentlyViewed } from "@/lib/recently-viewed";
import { currentRedirectPath } from "@/lib/navigation";
import { errorMessage } from "@/lib/utils";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PlusRequiredError } from "@/lib/payments/require-plus";
import type { Property } from "@/lib/properties";
import { whatsAppUrl } from "@/lib/phone";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Habari! I am your NyumbaSearch AI Assistant. Ask me anything about this property, the location, or security.",
};

function isAuthRequiredMessage(message: string): boolean {
  return /sign in|unauthorized|log in/i.test(message);
}

export function usePropertyDetail(id: string, initialProperty?: Property | null) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isPlus } = useEntitlements();
  const qc = useQueryClient();

  const authSearch = useMemo(() => ({ redirect: currentRedirectPath(location) }), [location]);

  const redirectToAuth = useCallback(() => {
    navigate({ to: "/auth", search: authSearch });
  }, [navigate, authSearch]);

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Suspicious listing");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [unlockedPhone, setUnlockedPhone] = useState<string | null>(null);

  useEffect(() => {
    setGalleryIndex(0);
    setChatMessages([WELCOME_MESSAGE]);
    setChatInput("");
    setChatLoading(false);
    setIsBookingOpen(false);
    setReportOpen(false);
    setReportDetails("");
    setReportReason("Suspicious listing");
  }, [id]);

  useEffect(() => {
    if (!user) return;
    const timer = globalThis.setTimeout(() => {
      void recordTenantLead({ data: { listingId: id, source: "view" } });
    }, 30_000);
    return () => globalThis.clearTimeout(timer);
  }, [user, id]);

  const {
    data: p,
    isLoading,
    isError,
    refetch,
  } = useQuery({
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

  useEffect(() => {
    const imageCount = p?.images.length ?? 0;
    if (imageCount === 0) {
      setGalleryIndex(0);
      return;
    }
    setGalleryIndex((index) => Math.min(index, imageCount - 1));
  }, [p?.images.length, id]);

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
    enabled: !!p?.owner_id && !!user,
    queryFn: () => getPropertyOwnerContact({ data: { propertyId: id } }),
  });

  useEffect(() => {
    if (landlordContact?.unlocked && landlordContact.phone) {
      setUnlockedPhone(landlordContact.phone);
    }
  }, [landlordContact?.unlocked, landlordContact?.phone]);

  const { data: valuation, isLoading: valLoading } = useQuery({
    queryKey: ["valuation", id],
    queryFn: () => getAIValuation({ data: { propertyId: id } }),
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
    onError: (err) => {
      const msg = errorMessage(err);
      toast.error(msg);
      if (isAuthRequiredMessage(msg)) redirectToAuth();
    },
  });

  const messageLandlord = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to message landlords");
      if (!isPlus) {
        throw new PlusRequiredError();
      }
      if (!p?.owner_id) throw new Error("Landlord contact is unavailable for this listing");

      const preferWhatsApp = Boolean(
        landlordContact?.preferWhatsApp || p.whatsapp_inquiries,
      );
      if (preferWhatsApp) {
        const phone = unlockedPhone?.trim() || landlordContact?.phone?.trim() || null;
        if (!phone) {
          document.getElementById("contact-unlock")?.scrollIntoView({ behavior: "smooth" });
          throw new Error("Unlock the contact number first, then tap Message to open WhatsApp");
        }
        const contactLabel = landlordContact?.fullName?.trim() || "there";
        const url = whatsAppUrl(
          phone,
          `Hi ${contactLabel}, I'm interested in "${p.title}" (${p.neighborhood}) on NyumbaSearch. Is it still available?`,
        );
        if (!url) throw new Error("Contact phone is not a valid WhatsApp number");
        globalThis.open(url, "_blank", "noopener,noreferrer");
        return { channel: "whatsapp" as const };
      }

      return createInquiry({
        data: {
          propertyId: id,
          message: `Hi, I'm interested in ${p.title}. Is it still available?`,
        },
      });
    },
    onSuccess: (result) => {
      if (result && "channel" in result && result.channel === "whatsapp") {
        toast.success("Opening WhatsApp…");
        return;
      }
      toast.success("Message sent to the landlord");
      navigate({ to: "/tenant/messages/$id", params: { id: (result as { id: string }).id } });
    },
    onError: (err) => {
      if (err instanceof PlusRequiredError) {
        toast.error(err.message, {
          action: {
            label: "Upgrade to Plus",
            onClick: () => navigate({ to: "/tenant/checkout", search: { plan: "plus" } }),
          },
        });
        return;
      }
      const msg = errorMessage(err);
      toast.error(msg);
      if (isAuthRequiredMessage(msg)) redirectToAuth();
    },
  });

  const handleCall = () => {
    if (!user) {
      toast.error("Sign in to call the landlord");
      redirectToAuth();
      return;
    }
    if (!p?.owner_id) {
      toast.error("Landlord contact is unavailable for this listing");
      return;
    }
    const phone = unlockedPhone?.trim();
    if (!phone) {
      document.getElementById("contact-unlock")?.scrollIntoView({ behavior: "smooth" });
      toast.info("Unlock the landlord's number first");
      return;
    }
    globalThis.location.href = `tel:${phone}`;
  };

  const submitChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ message: userMsg, propertyId: id }),
      });
      const payload = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
      const response =
        payload?.reply?.trim() ||
        (res.ok
          ? null
          : payload?.error) ||
        "I'm currently unable to access my AI engine. Please try again shortly.";
      if (!res.ok && !payload?.reply) throw new Error(response);
      setChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: response },
      ]);
    } catch {
      toast.error("AI assistant offline. Please try again.");
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, id]);

  const handleSendChat = useCallback(
    (e: SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      void submitChatMessage();
    },
    [submitChatMessage],
  );

  const openReportForm = () => {
    if (!user) {
      toast.error("Sign in to report a listing");
      redirectToAuth();
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
      toast.error(errorMessage(err));
    } finally {
      setReportSubmitting(false);
    }
  };

  const openBooking = () => {
    if (!user) {
      toast.error("Please sign in to book viewings");
      redirectToAuth();
      return;
    }
    if (!p?.owner_id) {
      toast.error("Viewing bookings are not available for this listing yet.");
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
    isSaved: isSaved ?? false,
    similar,
    landlordContact,
    unlockedPhone,
    setUnlockedPhone,
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
    handleSendChat,
    openReportForm,
    submitReport,
    openBooking,
    redirectToAuth,
  };
}
