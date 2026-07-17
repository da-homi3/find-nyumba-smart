import type { AppRole } from "@/hooks/use-auth";
import { getPresenceNamespace } from "@/lib/worker-bindings";

export type PresenceSession = {
  sessionId: string;
  userId: string | null;
  roles: string[];
  path: string;
  connectedAt: number | null;
  lastSeen: number | null;
};

export type PresenceSnapshot = {
  generatedAt: string;
  totalConnections: number;
  uniqueUsers: number;
  uniqueTenants: number;
  uniqueListingAccounts: number;
  anonymousSessions: number;
  sessions: PresenceSession[];
};

export function getPresenceStub() {
  const ns = getPresenceNamespace();
  if (!ns) return null;
  return ns.get(ns.idFromName("global"));
}

export async function fetchPresenceSnapshot(): Promise<PresenceSnapshot | null> {
  const stub = getPresenceStub();
  if (!stub) return null;

  try {
    const res = await stub.fetch(new Request("https://presence.internal/snapshot"));
    if (!res.ok) return null;
    return (await res.json()) as PresenceSnapshot;
  } catch (err) {
    console.warn("[presence] snapshot failed:", err);
    return null;
  }
}

export async function verifyPresenceAccessToken(
  token: string,
): Promise<{ userId: string; roles: AppRole[] } | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(trimmed);
    if (error || !data.user) return null;

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    const roles = (roleRows ?? []).map((row) => row.role as AppRole);
    return { userId: data.user.id, roles };
  } catch (err) {
    console.warn("[presence] auth verify failed:", err);
    return null;
  }
}

export async function forwardPresenceWebSocket(request: Request): Promise<Response> {
  const stub = getPresenceStub();
  if (!stub) {
    return new Response(JSON.stringify({ error: "presence_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId")?.trim() || crypto.randomUUID();
  const path = url.searchParams.get("path")?.trim() || "/";

  let userId: string | null = null;
  let roles: string[] = [];
  const token =
    url.searchParams.get("token")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (token) {
    const auth = await verifyPresenceAccessToken(token);
    if (auth) {
      userId = auth.userId;
      roles = auth.roles;
    }
  }

  const doUrl = new URL("https://presence.internal/ws");
  doUrl.searchParams.set("sessionId", sessionId);
  doUrl.searchParams.set("path", path);
  if (userId) doUrl.searchParams.set("userId", userId);
  if (roles.length > 0) doUrl.searchParams.set("roles", roles.join(","));

  return stub.fetch(
    new Request(doUrl.toString(), {
      headers: request.headers,
    }),
  );
}
