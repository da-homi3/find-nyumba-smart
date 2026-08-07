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
import type { PortalId } from "@/lib/portal-guard";

export type AppRole = "tenant" | "landlord" | "manager" | "agency" | "caretaker" | "admin";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  pendingApplications: PortalApplication[];
  activePortal: PortalId;
  loading: boolean;
  /** False until roles are known for the current session (or signed out). Prevents portal bounce. */
  rolesReady: boolean;
  isLandlord: boolean;
  isManager: boolean;
  isAgency: boolean;
  isAdmin: boolean;
  isTenant: boolean;
  hasApprovedRole: (role: AppRole) => boolean;
  setActivePortalChoice: (portal: PortalId) => Promise<void>;
  refreshPortalState: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Unblock the shell if session restore hangs — roles still wait separately. */
const AUTH_BOOT_TIMEOUT_MS = 20_000;
/** Don't leave portals spinning forever if user_roles is down. */
const AUTH_ROLES_TIMEOUT_MS = 12_000;

async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

async function fetchUserRolesWithTimeout(userId: string, ms: number): Promise<AppRole[]> {
  return Promise.race([
    fetchUserRoles(userId),
    new Promise<AppRole[]>((resolve) => {
      globalThis.setTimeout(() => {
        console.warn("[use-auth] Roles fetch timed out — continuing with empty roles");
        resolve([]);
      }, ms);
    }),
  ]);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [pendingApplications, setPendingApplications] = useState<PortalApplication[]>([]);
  const [activePortal, setActivePortal] = useState<PortalId>("tenant");
  const [loading, setLoading] = useState(true);
  const [rolesReady, setRolesReady] = useState(false);
  const sessionReadyRef = useRef(false);

  const refreshPortalState = useCallback(async (userId?: string) => {
    if (!userId) {
      setPendingApplications([]);
      setActivePortal("tenant");
      setRoles([]);
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
      const portal = (profile?.active_portal as PortalId) ?? "tenant";
      setActivePortal(portal);
    } catch (err) {
      console.warn("[use-auth] Could not refresh portal state:", err);
      setPendingApplications([]);
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
        console.warn("[use-auth] Auth boot timed out — continuing without full portal state");
        // Unblock public shells only. Keep rolesReady=false while a user is present so
        // landlord/manager/agency/admin layouts do not bounce to /auth with empty roles.
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
        setRolesReady(true);
        finishLoading();
        return;
      }

      setRolesReady(false);
      try {
        // Unblock shells as soon as roles resolve; portal apps can trail in the background.
        const nextRoles = await fetchUserRolesWithTimeout(s.user.id, AUTH_ROLES_TIMEOUT_MS);
        if (!active) return;
        setRoles(nextRoles);
        sessionReadyRef.current = true;
        setRolesReady(true);
        finishLoading();
        void refreshPortalState(s.user.id);
      } catch (err) {
        console.warn("[use-auth] session sync failed:", err);
        if (active) setRolesReady(true);
        finishLoading();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refresh must not re-hit roles/portal APIs — that freezes the UI periodically.
      if (event === "TOKEN_REFRESHED") {
        if (!active) return;
        setSession(s);
        setUser(s?.user ?? null);
        return;
      }
      // Android WebView often re-emits SIGNED_IN / INITIAL_SESSION on focus —
      // don't tear down dashboards/wizards once the session is already ready.
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
      const showLoading =
        event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT";
      if (showLoading) {
        setLoading(true);
        armBootTimeout();
      }
      void syncSession(s);
    });

    setLoading(true);
    armBootTimeout();
    supabase.auth.getSession().then(({ data: { session: s } }) => void syncSession(s));

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
      isLandlord: roleSet.has("landlord"),
      isManager: roleSet.has("manager"),
      isAgency: roleSet.has("agency"),
      isAdmin: roleSet.has("admin"),
      isTenant: roleSet.has("tenant") || roles.length === 0,
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
