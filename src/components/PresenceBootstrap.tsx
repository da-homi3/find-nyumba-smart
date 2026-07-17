import { useAuth } from "@/hooks/use-auth";
import { usePresenceConnection } from "@/hooks/use-presence-connection";

/** Maintains a live WebSocket presence channel for real-time admin analytics. */
export function PresenceBootstrap() {
  const { user, roles, session } = useAuth();

  usePresenceConnection({
    userId: user?.id,
    roles,
    accessToken: session?.access_token,
  });

  return null;
}
