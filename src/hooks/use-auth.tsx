/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyPortalApplications,
  getMyProfilePortal,
  setActivePortal as setActivePortalApi,
  type PortalApplication,
} from "@/lib/api/portal.functions";
import { clearCaretakerToken } from "@/lib/caretaker-session";
import { clearAuthGateDismiss } from "@/lib/auth/auth-gate";
import { withTimeout } from "@/lib/auth/with-timeout";
import type { PortalId } from "@/lib/portal-guard";

export type AppRole =
  | "tenant"
  | "landlord"
  | "manager"
  | "agency"
  | "property_developer"
  | "agent"
  | "caretaker"
  | "admin";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  pendingApplications: PortalApplication[];
  activePortal: PortalId;
  loading: boolean;
  /** False until roles are known for the current session (or signed out). Prevents portal bounce. */
  rolesReady: boolean;
  /** True when roles fetch timed out or failed — portals must retry, not treat as tenant. */
  rolesError: boolean;
  isLandlord: boolean;
  isManager: boolean;
  isAgency: boolean;
  isPropertyDeveloper: boolean;
  isAgent: boolean;
  isAdmin: boolean;
  isTenant: boolean;
  hasApprovedRole: (role: AppRole) => boolean;
  setActivePortalChoice: (portal: PortalId) => Promise<void>;
  refreshPortalState: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Unblock the shell if session restore hangs. */
const AUTH_BOOT_TIMEOUT_MS = 8_000;
/** Don't leave portals spinning forever if user_roles is down. */
const AUTH_ROLES_TIMEOUT_MS = 8_000;
/** Cap getSession so it cannot deadlock password sign-in on the auth lock. */
const AUTH_GET_SESSION_TIMEOUT_MS = 3_000;

async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.error(error);
    throw error;
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

type RolesFetchResult = { roles: AppRole[]; failed: boolean };

async function fetchUserRolesWithTimeout(userId: string, ms: number): Promise<RolesFetchResult> {
  let timedOut = false;
  try {
    const roles = await Promise.race([
      fetchUserRoles(userId),
      new Promise<AppRole[]>((_, reject) => {
        globalThis.setTimeout(() => {
          timedOut = true;
          reject(new Error("roles_timeout"));
        }, ms);
      }),
    ]);
    return { roles, failed: false };
  } catch (err) {
    if (timedOut) {
      console.warn("[use-auth] Roles fetch timed out — retrying once");
      try {
        const roles = await fetchUserRoles(userId);
        return { roles, failed: false };
      } catch (retryErr) {
        console.warn("[use-auth] Roles retry failed:", retryErr);
        return { roles: [], failed: true };
      }
    }
    console.warn("[use-auth] Roles fetch failed:", err);
    return { roles: [], failed: true };
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [pendingApplications, setPendingApplications] = useState<PortalApplication[]>([]);
  const [activePortal, setActivePortal] = useState<PortalId>("tenant");
  const [loading, setLoading] = useState(true);
  const [rolesReady, setRolesReady] = useState(false);
  const [rolesError, setRolesError] = useState(false);
  const sessionReadyRef = useRef(false);

  const refreshPortalState = useCallback(async (userId?: string) => {
    if (!userId) {
      setPendingApplications([]);
      setActivePortal("tenant");
      setRoles([]);
      setRolesError(false);
      return;
    }
    try {
      const [apps, profile, nextRoles] = await Promise.all([
        listMyPortalApplications(),
        getMyProfilePortal(),
        fetchUserRoles(userId),
      ]);
      setPendingApplications(apps);
      setRoles(nextRoles);
      setRolesError(false);
      setRolesReady(true);
      const portal = (profile?.active_portal as PortalId) ?? "tenant";
      setActivePortal(portal);
    } catch (err) {
      console.warn("[use-auth] Could not refresh portal state:", err);
      setPendingApplications([]);
      setRolesError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let bootTimer: ReturnType<typeof setTimeout> | undefined;

    const clearBootTimer = () => {
      if (bootTimer) {
        clearTimeout(bootTimer);
        bootTimer = undefined;
      }
    };

    const finishLoading = () => {
      if (!active) return;
      clearBootTimer();
      setLoading(false);
    };

    const armBootTimeout = () => {
      clearBootTimer();
      bootTimer = setTimeout(() => {
        if (!active) return;
        console.warn("[use-auth] Auth boot timed out — fail-open so sign-in is usable");
        // Unblock the shell, but mark roles as errored when a session may still be restoring
        // so portal layouts retry instead of ejecting landlords as "no role".
        setRolesError(true);
        setRolesReady(true);
        setLoading(false);
      }, AUTH_BOOT_TIMEOUT_MS);
    };

    const syncSession = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        sessionReadyRef.current = false;
        setRoles([]);
        setPendingApplications([]);
        setActivePortal("tenant");
        setRolesError(false);
        setRolesReady(true);
        finishLoading();
        return;
      }

      setRolesReady(false);
      setRolesError(false);
      try {
        const result = await fetchUserRolesWithTimeout(s.user.id, AUTH_ROLES_TIMEOUT_MS);
        if (!active) return;
        setRoles(result.roles);
        setRolesError(result.failed);
        sessionReadyRef.current = true;
        setRolesReady(true);
        finishLoading();
        if (!result.failed) {
          void refreshPortalState(s.user.id);
        }
      } catch (err) {
        console.warn("[use-auth] session sync failed:", err);
        if (active) {
          setRolesError(true);
          setRolesReady(true);
        }
        finishLoading();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED") {
        if (!active) return;
        setSession(s);
        setUser(s?.user ?? null);
        return;
      }
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        sessionReadyRef.current &&
        s?.user
      ) {
        setSession(s);
        setUser(s.user);
        void refreshPortalState(s.user.id);
        return;
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
        setLoading(true);
        armBootTimeout();
      }
      void syncSession(s);
    });

    setLoading(true);
    armBootTimeout();
    // Fallback if INITIAL_SESSION is delayed. Ignore timed-out null — wait for auth events.
    void withTimeout(
      supabase.auth.getSession(),
      AUTH_GET_SESSION_TIMEOUT_MS,
      { data: { session: null }, error: null } as Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >,
    ).then(({ data: { session: s } }) => {
      if (!active || sessionReadyRef.current) return;
      if (s?.user) void syncSession(s);
    });

    return () => {
      active = false;
      clearBootTimer();
      subscription.unsubscribe();
    };
  }, [refreshPortalState]);

  const roleSet = useMemo(() => new Set(roles), [roles]);
  const hasApprovedRole = useCallback((role: AppRole) => roleSet.has(role), [roleSet]);

  const setActivePortalChoice = useCallback(async (portal: PortalId) => {
    await setActivePortalApi({ data: { portal } });
    setActivePortal(portal);
  }, []);

  const signOut = useCallback(async () => {
    clearCaretakerToken();
    clearAuthGateDismiss();
    await supabase.auth.signOut();
    globalThis.location.href = "/tenant";
  }, []);

  const refreshPortalStateForUser = useCallback(
    async () => refreshPortalState(user?.id),
    [refreshPortalState, user?.id],
  );

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      session,
      roles,
      pendingApplications,
      activePortal,
      loading,
      rolesReady,
      rolesError,
      isLandlord: roleSet.has("landlord"),
      isManager: roleSet.has("manager"),
      isAgency: roleSet.has("agency"),
      isPropertyDeveloper: roleSet.has("property_developer"),
      isAgent: roleSet.has("agent"),
      isAdmin: roleSet.has("admin"),
      // Confirmed empty roles ⇒ tenant. On rolesError, do not claim tenant (portals must retry).
      isTenant: roleSet.has("tenant") || (roles.length === 0 && !rolesError),
      hasApprovedRole,
      setActivePortalChoice,
      refreshPortalState: refreshPortalStateForUser,
      signOut,
    }),
    [
      user,
      session,
      roles,
      pendingApplications,
      activePortal,
      loading,
      rolesReady,
      rolesError,
      roleSet,
      hasApprovedRole,
      setActivePortalChoice,
      refreshPortalStateForUser,
      signOut,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
