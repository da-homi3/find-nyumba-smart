import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendText } from "@/lib/whatsapp/client";
import { isWhatsAppConfigured } from "@/lib/whatsapp/env";
import { notifyViewingConfirmed } from "@/lib/whatsapp/templates";

type Admin = SupabaseClient<Database>;

/** Nairobi-local calendar day boundaries as UTC ISO strings. */
function nairobiDayRange(dayOffset: number): { start: string; end: string; label: string } {
  const now = new Date();
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const eatNow = new Date(now.getTime() + eatOffsetMs);
  const y = eatNow.getUTCFullYear();
  const m = eatNow.getUTCMonth();
  const d = eatNow.getUTCDate() + dayOffset;

  const startEat = new Date(Date.UTC(y, m, d, 0, 0, 0));
  const endEat = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

  const start = new Date(startEat.getTime() - eatOffsetMs).toISOString();
  const end = new Date(endEat.getTime() - eatOffsetMs).toISOString();

  const label = startEat.toLocaleDateString("en-KE", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return { start, end, label };
}

function isWaPhone(phone: string | null | undefined): phone is string {
  return Boolean(phone?.startsWith("254"));
}

async function alreadySent(
  admin: Admin,
  reminderType: string,
  referenceId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("whatsapp_reminder_log")
    .select("id")
    .eq("reminder_type", reminderType)
    .eq("reference_id", referenceId)
    .maybeSingle();
  return Boolean(data);
}

async function markSent(
  admin: Admin,
  reminderType: string,
  referenceId: string,
  waPhone: string,
): Promise<void> {
  await admin.from("whatsapp_reminder_log").upsert(
    {
      reminder_type: reminderType,
      reference_id: referenceId,
      wa_phone: waPhone,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "reminder_type,reference_id" },
  );
}

type ViewingRow = {
  id: string;
  scheduled_at: string;
  status: string;
  tenant_id: string;
  landlord_id: string;
  properties: { title: string; neighborhood: string; address: string | null } | null;
};

async function sendViewingReminder(
  admin: Admin,
  viewing: ViewingRow,
  reminderType: "viewing_tomorrow" | "viewing_today",
  dayLabel: string,
): Promise<boolean> {
  if (await alreadySent(admin, reminderType, viewing.id)) return false;

  const { data: tenant } = await admin
    .from("profiles")
    .select("phone, full_name")
    .eq("id", viewing.tenant_id)
    .maybeSingle();

  const waPhone = tenant?.phone;
  if (!isWaPhone(waPhone)) return false;

  const property = viewing.properties;
  const title = property?.title ?? "your viewing";
  const address = property?.address ?? property?.neighborhood ?? "See listing on NyumbaSearch";
  const when = new Date(viewing.scheduled_at);
  const time = when.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
  const date = when.toLocaleDateString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Africa/Nairobi",
  });
  const firstName = tenant?.full_name?.split(/\s+/)[0] ?? "there";

  const prefix = reminderType === "viewing_tomorrow" ? "tomorrow" : "today";

  try {
    await notifyViewingConfirmed(waPhone, firstName, title, date, time, address);
  } catch {
    await sendText(
      waPhone,
      `*Viewing reminder*\n\nHi ${firstName}, your viewing for *${title}* is ${prefix} (${dayLabel}) at *${time}*.\n\nAddress: ${address}\n\nReply *my_viewings* for details.`,
      admin,
    );
  }

  await markSent(admin, reminderType, viewing.id, waPhone);
  return true;
}

/** Send WhatsApp reminders for viewings scheduled tomorrow (and same-day morning nudge). */
export async function runViewingReminderCron(admin: Admin): Promise<{
  tomorrow: number;
  today: number;
  skipped: boolean;
}> {
  if (!isWhatsAppConfigured()) {
    return { tomorrow: 0, today: 0, skipped: true };
  }

  const tomorrow = nairobiDayRange(1);
  const today = nairobiDayRange(0);

  const { data: tomorrowRows } = await admin
    .from("viewings")
    .select(
      "id, scheduled_at, status, tenant_id, landlord_id, properties(title, neighborhood, address)",
    )
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", tomorrow.start)
    .lte("scheduled_at", tomorrow.end);

  const { data: todayRows } = await admin
    .from("viewings")
    .select(
      "id, scheduled_at, status, tenant_id, landlord_id, properties(title, neighborhood, address)",
    )
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", today.start)
    .lte("scheduled_at", today.end);

  let tomorrowSent = 0;
  for (const row of (tomorrowRows ?? []) as ViewingRow[]) {
    if (await sendViewingReminder(admin, row, "viewing_tomorrow", tomorrow.label)) {
      tomorrowSent += 1;
    }
  }

  let todaySent = 0;
  for (const row of (todayRows ?? []) as ViewingRow[]) {
    if (await sendViewingReminder(admin, row, "viewing_today", today.label)) {
      todaySent += 1;
    }
  }

  return { tomorrow: tomorrowSent, today: todaySent, skipped: false };
}
