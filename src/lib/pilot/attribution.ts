import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  eventTypeToKpiMetric,
  LEAD_EVENT_TYPES,
  metricFromEventType,
  type PilotEventType,
  type PilotLeadType,
} from "@/lib/pilot/types";

type Admin = SupabaseClient<Database>;

type AttributionCandidate = {
  id: string;
  pilot_id: string;
  approved_at: string | null;
  added_at: string;
};

/**
 * Pure ranking helper: single winner by latest approved_at (fallback added_at).
 * Ensures no double-count when multiple pilots claim the same property.
 */
export function pickWinningPilotProperty(
  rows: ReadonlyArray<AttributionCandidate>,
): AttributionCandidate | null {
  if (!rows.length) return null;
  const ranked = [...rows].sort((a, b) => {
    const aTime = new Date(a.approved_at ?? a.added_at).getTime();
    const bTime = new Date(b.approved_at ?? b.added_at).getTime();
    return bTime - aTime;
  });
  return ranked[0] ?? null;
}

/**
 * Deterministic attribution: among LIVE properties on ACTIVE/EXTENDED/CONVERTED pilots,
 * pick the pilot with the latest approved_at (fallback added_at).
 */
export async function resolvePilotAttribution(
  admin: Admin,
  propertyId: string,
): Promise<{ pilotId: string; pilotPropertyId: string } | null> {
  const { data, error } = await admin
    .from("pilot_properties")
    .select("id, pilot_id, approved_at, added_at, pilot_partnerships!inner(id, status)")
    .eq("property_id", propertyId)
    .eq("status", "LIVE")
    .in("pilot_partnerships.status", ["ACTIVE", "EXTENDED", "CONVERTED"]);

  if (error) {
    console.error("resolvePilotAttribution:", error.message);
    return null;
  }
  if (!data?.length) return null;

  const winner = pickWinningPilotProperty(data);
  if (!winner) return null;
  return { pilotId: winner.pilot_id, pilotPropertyId: winner.id };
}

export async function recordPilotEvent(
  admin: Admin,
  input: {
    propertyId?: string | null;
    pilotId?: string | null;
    eventType: PilotEventType;
    userId?: string | null;
    sessionId?: string | null;
    source?: string | null;
    metadata?: Record<string, unknown>;
    createLead?: boolean;
    leadType?: PilotLeadType;
    inquiryId?: string | null;
    viewingId?: string | null;
    revenueLeadId?: string | null;
    displayLabel?: string | null;
  },
): Promise<{ pilotId: string | null; eventId: string | null }> {
  let pilotId = input.pilotId ?? null;
  if (!pilotId && input.propertyId) {
    const attributed = await resolvePilotAttribution(admin, input.propertyId);
    pilotId = attributed?.pilotId ?? null;
  }
  if (!pilotId) return { pilotId: null, eventId: null };

  const { data: event, error } = await admin
    .from("pilot_analytics_events")
    .insert({
      pilot_id: pilotId,
      property_id: input.propertyId ?? null,
      user_id: input.userId ?? null,
      session_id: input.sessionId ?? null,
      event_type: input.eventType,
      source: input.source ?? null,
      metadata: (input.metadata ??
        {}) as Database["public"]["Tables"]["pilot_analytics_events"]["Insert"]["metadata"],
    })
    .select("id")
    .single();

  if (error) {
    console.error("recordPilotEvent:", error.message);
    return { pilotId, eventId: null };
  }

  await bumpDailyMetric(admin, {
    pilotId,
    propertyId: input.propertyId ?? null,
    eventType: input.eventType,
  });
  await bumpKpiActual(admin, pilotId, input.eventType);

  const leadType = input.leadType ?? LEAD_EVENT_TYPES[input.eventType];
  if (input.createLead !== false && leadType) {
    await admin.from("pilot_leads").insert({
      pilot_id: pilotId,
      property_id: input.propertyId ?? null,
      lead_type: leadType,
      contact_method: input.eventType.toLowerCase(),
      inquiry_id: input.inquiryId ?? null,
      viewing_id: input.viewingId ?? null,
      revenue_lead_id: input.revenueLeadId ?? null,
      tenant_user_id: input.userId ?? null,
      display_label: input.displayLabel ?? null,
    });
  }

  return { pilotId, eventId: event.id };
}

async function bumpDailyMetric(
  admin: Admin,
  input: { pilotId: string; propertyId: string | null; eventType: PilotEventType },
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const column = metricFromEventType(input.eventType);

  let query = admin
    .from("pilot_metrics_daily")
    .select("*")
    .eq("pilot_id", input.pilotId)
    .eq("day", day);
  query = input.propertyId
    ? query.eq("property_id", input.propertyId)
    : query.is("property_id", null);

  const { data: existing } = await query.maybeSingle();

  if (!existing) {
    const insertRow: Database["public"]["Tables"]["pilot_metrics_daily"]["Insert"] = {
      pilot_id: input.pilotId,
      property_id: input.propertyId,
      day,
      impressions: 0,
      views: 0,
      saves: 0,
      contact_clicks: 0,
      call_clicks: 0,
      whatsapp_clicks: 0,
      enquiries: 0,
      viewing_requests: 0,
      share_clicks: 0,
      directions_clicks: 0,
    };
    insertRow[column] = 1;
    await admin.from("pilot_metrics_daily").insert(insertRow);
    return;
  }

  const next = Number(existing[column] ?? 0) + 1;
  const patch: Database["public"]["Tables"]["pilot_metrics_daily"]["Update"] = {
    [column]: next,
  };
  await admin.from("pilot_metrics_daily").update(patch).eq("id", existing.id);
}

async function bumpKpiActual(
  admin: Admin,
  pilotId: string,
  eventType: PilotEventType,
): Promise<void> {
  const metric = eventTypeToKpiMetric(eventType);
  if (!metric) return;
  const { data } = await admin
    .from("pilot_kpis")
    .select("id, actual")
    .eq("pilot_id", pilotId)
    .eq("metric", metric)
    .maybeSingle();
  if (!data) return;
  await admin
    .from("pilot_kpis")
    .update({ actual: Number(data.actual) + 1, updated_at: new Date().toISOString() })
    .eq("id", data.id);
}

export async function aggregatePilotMetricsForDay(
  admin: Admin,
  day = new Date().toISOString().slice(0, 10),
): Promise<number> {
  const start = `${day}T00:00:00.000Z`;
  const end = `${day}T23:59:59.999Z`;
  const { data: events, error } = await admin
    .from("pilot_analytics_events")
    .select("pilot_id, property_id, event_type")
    .gte("created_at", start)
    .lte("created_at", end)
    .limit(20000);
  if (error) {
    console.error("aggregatePilotMetricsForDay:", error.message);
    return 0;
  }

  const buckets = new Map<
    string,
    {
      pilot_id: string;
      property_id: string | null;
      impressions: number;
      views: number;
      saves: number;
      contact_clicks: number;
      call_clicks: number;
      whatsapp_clicks: number;
      enquiries: number;
      viewing_requests: number;
      share_clicks: number;
      directions_clicks: number;
    }
  >();

  for (const event of events ?? []) {
    const key = `${event.pilot_id}:${event.property_id ?? "null"}`;
    const bucket =
      buckets.get(key) ??
      ({
        pilot_id: event.pilot_id,
        property_id: event.property_id,
        impressions: 0,
        views: 0,
        saves: 0,
        contact_clicks: 0,
        call_clicks: 0,
        whatsapp_clicks: 0,
        enquiries: 0,
        viewing_requests: 0,
        share_clicks: 0,
        directions_clicks: 0,
      } as const);
    const mutable = { ...bucket };
    const column = metricFromEventType(event.event_type as PilotEventType);
    mutable[column] += 1;
    buckets.set(key, mutable);
  }

  let written = 0;
  for (const row of buckets.values()) {
    const { error: upsertError } = await admin
      .from("pilot_metrics_daily")
      .upsert({ ...row, day }, { onConflict: "pilot_id,property_id,day" });
    if (!upsertError) written += 1;
  }
  return written;
}
