import { useAuth } from "@/hooks/use-auth";
import { usePresenceConnection } from "@/hooks/use-presence-connection";

/** Maintains a live WebSocket presence channel for real-time admin analytics. */
export function PresenceBootstrap() {
  const { user, roles, session } = useAuth();
  // Presence DO is for admin live analytics — skip for anonymous/public visitors.
  const enabled = Boolean(user?.id && roles.includes("admin"));

  usePresenceConnection({
    enabled,
    userId: enabled ? user?.id : null,
    roles: enabled ? roles : [],
    accessToken: enabled ? session?.access_token : null,
  });

  return null;
}
