import { DurableObject } from "cloudflare:workers";

const TENANT_ROLE = "tenant";
const LISTING_ROLES = new Set(["landlord", "agency", "manager"]);

function parseRoles(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

function attachmentFromSearchParams(url) {
  const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();
  const userId = url.searchParams.get("userId") || null;
  const roles = parseRoles(url.searchParams.get("roles"));
  const path = url.searchParams.get("path") || "/";
  const now = Date.now();
  return {
    sessionId,
    userId,
    roles,
    path,
    connectedAt: now,
    lastSeen: now,
  };
}

function mergeAttachment(current, patch) {
  return {
    sessionId: patch.sessionId ?? current?.sessionId ?? crypto.randomUUID(),
    userId: patch.userId ?? current?.userId ?? null,
    roles: patch.roles ?? current?.roles ?? [],
    path: patch.path ?? current?.path ?? "/",
    connectedAt: current?.connectedAt ?? Date.now(),
    lastSeen: Date.now(),
  };
}

function applyRoleSets(userId, roles, tenantIds, listingAccountIds) {
  for (const role of roles) {
    if (role === TENANT_ROLE) tenantIds.add(userId);
    if (LISTING_ROLES.has(role)) listingAccountIds.add(userId);
  }
}

function collectPresenceSession(att, state) {
  state.sessions.push({
    sessionId: att.sessionId,
    userId: att.userId,
    roles: att.roles ?? [],
    path: att.path ?? "/",
    connectedAt: att.connectedAt ?? null,
    lastSeen: att.lastSeen ?? null,
  });

  if (!att.userId) {
    state.anonymousSessions += 1;
    return;
  }

  state.userIds.add(att.userId);
  applyRoleSets(att.userId, att.roles ?? [], state.tenantIds, state.listingAccountIds);
}

export class PresenceDurableObject extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/snapshot") {
      return Response.json(this.buildSnapshot());
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachmentFromSearchParams(url));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws, message) {
    let payload;
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      payload = JSON.parse(text);
    } catch {
      return;
    }

    const current = ws.deserializeAttachment() ?? {};
    const patch = {};

    if (payload.type === "auth") {
      patch.userId = payload.userId ?? null;
      patch.roles = Array.isArray(payload.roles) ? payload.roles : [];
      patch.sessionId = payload.sessionId ?? current.sessionId;
    }

    if (payload.type === "ping" || payload.type === "page") {
      if (typeof payload.path === "string") patch.path = payload.path;
      if (payload.sessionId) patch.sessionId = payload.sessionId;
    }

    ws.serializeAttachment(mergeAttachment(current, patch));

    if (payload.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
    }
  }

  async webSocketClose() {
    // Hibernation API cleans up closed sockets automatically.
  }

  async webSocketError() {
    // No-op — socket will close and drop from getWebSockets().
  }

  buildSnapshot() {
    const sockets = this.ctx.getWebSockets();
    const state = {
      sessions: [],
      userIds: new Set(),
      tenantIds: new Set(),
      listingAccountIds: new Set(),
      anonymousSessions: 0,
    };

    for (const ws of sockets) {
      const att = ws.deserializeAttachment();
      if (!att) continue;
      collectPresenceSession(att, state);
    }

    state.sessions.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

    return {
      generatedAt: new Date().toISOString(),
      totalConnections: sockets.length,
      uniqueUsers: state.userIds.size,
      uniqueTenants: state.tenantIds.size,
      uniqueListingAccounts: state.listingAccountIds.size,
      anonymousSessions: state.anonymousSessions,
      sessions: state.sessions.slice(0, 250),
    };
  }
}
