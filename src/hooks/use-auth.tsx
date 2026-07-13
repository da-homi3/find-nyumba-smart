/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import type { PortalId } from "@/lib/portal-guard";

export type AppRole = "tenant" | "landlord" | "manager" | "agency" | "caretaker" | "admin";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  pendingApplications: PortalApplication[];
  activePortal: PortalId;
  loading: boolean;
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

const AUTH_BOOT_TIMEOUT_MS = 12_000;

async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [pendingApplications, setPendingApplications] = useState<PortalApplication[]>([]);
  const [activePortal, setActivePortal] = useState<PortalId>("tenant");
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      }, AUTH_BOOT_TIMEOUT_MS);
    };

    const syncSession = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setRoles([]);
        setPendingApplications([]);
        setActivePortal("tenant");
        finishLoading();
        return;
      }

      try {
        const nextRoles = await fetchUserRoles(s.user.id);
        if (!active) return;
        setRoles(nextRoles);
        await refreshPortalState(s.user.id);
      } finally {
        finishLoading();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED") {
        void syncSession(s);
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
