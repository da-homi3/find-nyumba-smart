import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type TrustMetrics = {
  noAgentFeesPct: number;
  avgResponseHours: number;
  tenantRating: number;
};

const FALLBACK: TrustMetrics = {
  noAgentFeesPct: 98,
  avgResponseHours: 24,
  tenantRating: 4.7,
};

const INQUIRY_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_RESPONSE_HOURS = 720;

function roundRating(n: number): number {
  return Math.round(n * 10) / 10;
}

export function averageReviewRating(reviews: { rating_overall: number }[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, row) => acc + row.rating_overall, 0);
  return roundRating(sum / reviews.length);
}

export function inquiryResponseMetrics(
  inquiries: { id: string; created_at: string; landlord_id: string | null }[],
  messages: { inquiry_id: string; sender_id: string; created_at: string }[],
): { avgResponseHours: number | null; responseRatePct: number } {
  if (inquiries.length === 0) return { avgResponseHours: null, responseRatePct: 0 };

  const landlordByInquiry = new Map(inquiries.map((row) => [row.id, row.landlord_id]));
  const createdByInquiry = new Map(inquiries.map((row) => [row.id, row.created_at]));
  const firstLandlordReply = new Map<string, string>();

  for (const msg of messages) {
    const landlordId = landlordByInquiry.get(msg.inquiry_id);
    if (!landlordId || msg.sender_id !== landlordId) continue;
    const existing = firstLandlordReply.get(msg.inquiry_id);
    if (!existing || msg.created_at < existing) {
      firstLandlordReply.set(msg.inquiry_id, msg.created_at);
    }
  }

  let totalHours = 0;
  let responded = 0;
  for (const [inquiryId, replyAt] of firstLandlordReply) {
    const created = createdByInquiry.get(inquiryId);
    if (!created) continue;
    const hours = (new Date(replyAt).getTime() - new Date(created).getTime()) / 3_600_000;
    if (hours < 0 || hours > MAX_RESPONSE_HOURS) continue;
    totalHours += hours;
    responded += 1;
  }

  return {
    avgResponseHours: responded > 0 ? Math.max(1, Math.round(totalHours / responded)) : null,
    responseRatePct: Math.round((responded / inquiries.length) * 100),
  };
}

/** Platform trust KPIs for homepage — aggregated only, no PII exposed. */
export async function loadTrustMetrics(admin: Admin): Promise<TrustMetrics> {
  const since = new Date(Date.now() - INQUIRY_LOOKBACK_MS).toISOString();

  const [activeRes, directRes, reviewsRes, inquiriesRes] = await Promise.all([
    admin.from("properties").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .not("owner_id", "is", null),
    admin.from("property_reviews").select("rating_overall").limit(500),
    admin
      .from("inquiries")
      .select("id, created_at, landlord_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const activeCount = activeRes.count ?? 0;
  const directCount = directRes.count ?? 0;
  const noAgentFeesPct =
    activeCount > 0
      ? Math.min(100, Math.round((directCount / activeCount) * 100))
      : FALLBACK.noAgentFeesPct;

  const reviewAvg = averageReviewRating(reviewsRes.data ?? []);
  const tenantRating = reviewAvg ?? FALLBACK.tenantRating;

  const inquiries = inquiriesRes.data ?? [];
  let avgResponseHours = FALLBACK.avgResponseHours;

  if (inquiries.length >= 5) {
    const inquiryIds = inquiries.map((row) => row.id);
    const { data: messages } = await admin
      .from("inquiry_messages")
      .select("inquiry_id, sender_id, created_at")
      .in("inquiry_id", inquiryIds);

    const { avgResponseHours: computed } = inquiryResponseMetrics(inquiries, messages ?? []);
    if (computed !== null) avgResponseHours = computed;
  }

  return { noAgentFeesPct, avgResponseHours, tenantRating };
}
