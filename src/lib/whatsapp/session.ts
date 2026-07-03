import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { WaRole, WaSession } from "@/lib/whatsapp/types";

type Admin = SupabaseClient<Database>;

function defaultSession(waPhone: string): WaSession {
  return {
    waPhone,
    userId: null,
    role: "unknown",
    state: "start",
    context: {},
    lastMessageAt: new Date().toISOString(),
  };
}

function rowToSession(row: {
  wa_phone: string;
  user_id: string | null;
  role: string;
  state: string;
  context: unknown;
  last_message_at: string;
}): WaSession {
  return {
    waPhone: row.wa_phone,
    userId: row.user_id,
    role: row.role as WaRole,
    state: row.state,
    context: (row.context as Record<string, unknown>) ?? {},
    lastMessageAt: row.last_message_at,
  };
}

export async function getSession(admin: Admin, waPhone: string): Promise<WaSession> {
  const { data } = await admin
    .from("whatsapp_sessions")
    .select("wa_phone, user_id, role, state, context, last_message_at")
    .eq("wa_phone", waPhone)
    .maybeSingle();

  if (data) return rowToSession(data);
  return defaultSession(waPhone);
}

export async function saveSession(admin: Admin, session: WaSession): Promise<void> {
  const now = new Date().toISOString();
  session.lastMessageAt = now;

  await admin.from("whatsapp_sessions").upsert(
    {
      wa_phone: session.waPhone,
      user_id: session.userId,
      role: session.role,
      state: session.state,
      context: session.context as Json,
      last_message_at: now,
    },
    { onConflict: "wa_phone" },
  );
}

export async function clearSession(admin: Admin, waPhone: string): Promise<void> {
  await admin.from("whatsapp_sessions").delete().eq("wa_phone", waPhone);
}

export async function updateState(
  admin: Admin,
  waPhone: string,
  state: string,
  contextUpdate?: Record<string, unknown>,
): Promise<WaSession> {
  const session = await getSession(admin, waPhone);
  session.state = state;
  if (contextUpdate) {
    session.context = { ...session.context, ...contextUpdate };
  }
  await saveSession(admin, session);
  return session;
}

export async function resolveUserIdByPhone(admin: Admin, waPhone: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("id").eq("phone", waPhone).maybeSingle();
  return data?.id ?? null;
}
