import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { AppRole } from "@/hooks/use-auth";
import { getAnonymousSessionId } from "@/lib/anonymous-session";

const PING_MS = 25_000;
const RECONNECT_MS = 4_000;

type PresenceSocket = WebSocket & { __nyumbaPresence?: boolean };

function presenceWsUrl(sessionId: string, path: string, token?: string | null) {
  const proto = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${proto}//${globalThis.location.host}/api/presence/ws`);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("path", path);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

function clearTimer(kind: "interval" | "timeout", id: number | null) {
  if (id == null) return;
  if (kind === "interval") globalThis.clearInterval(id);
  else globalThis.clearTimeout(id);
}

export function usePresenceConnection(args: {
  userId: string | null | undefined;
  roles: AppRole[];
  accessToken: string | null | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const socketRef = useRef<PresenceSocket | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string>(getAnonymousSessionId() ?? crypto.randomUUID());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;

    const clearTimers = () => {
      clearTimer("interval", pingTimerRef.current);
      pingTimerRef.current = null;
      clearTimer("timeout", reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const sendAuth = (socket: WebSocket) => {
      if (!args.userId) return;
      socket.send(
        JSON.stringify({
          type: "auth",
          userId: args.userId,
          roles: args.roles,
          sessionId: sessionIdRef.current,
        }),
      );
    };

    const sendPing = (socket: WebSocket) => {
      socket.send(
        JSON.stringify({
          type: "ping",
          path: pathname,
          sessionId: sessionIdRef.current,
        }),
      );
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current != null) return;
      reconnectTimerRef.current = globalThis.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, RECONNECT_MS);
    };

    const onSocketOpen = (socket: WebSocket) => {
      if (cancelled) return;
      sendAuth(socket);
      sendPing(socket);
      const pingIfOpen = () => {
        if (socket.readyState === WebSocket.OPEN) sendPing(socket);
      };
      pingTimerRef.current = globalThis.setInterval(pingIfOpen, PING_MS);
    };

    const connect = () => {
      if (cancelled) return;
      clearTimers();

      const socket = new WebSocket(
        presenceWsUrl(sessionIdRef.current, pathname, args.accessToken),
      ) as PresenceSocket;
      socket.__nyumbaPresence = true;
      socketRef.current = socket;

      socket.addEventListener("open", () => onSocketOpen(socket));
      socket.addEventListener("close", () => {
        if (cancelled) return;
        clearTimers();
        socketRef.current = null;
        scheduleReconnect();
      });
      socket.addEventListener("error", () => {
        socket.close();
      });
    };

    connect();

    return () => {
      cancelled = true;
      clearTimers();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [args.accessToken, args.roles, args.userId, pathname]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "page",
        path: pathname,
        sessionId: sessionIdRef.current,
      }),
    );
  }, [pathname]);
}
