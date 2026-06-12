/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyPortalApplications,
  getMyProfilePortal,
  setActivePortal,
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
  const [activePortal, setActivePortalState] = useState<PortalId>("tenant");
  const [loading, setLoading] = useState(true);

  const refreshPortalState = async (userId?: string) => {
    if (!userId) {
      setPendingApplications([]);
      setActivePortalState("tenant");
      return;
    }
    try {
      const [apps, profile] = await Promise.all([listMyPortalApplications(), getMyProfilePortal()]);
      setPendingApplications(apps);
      const portal = (profile?.active_portal as PortalId) ?? "tenant";
      setActivePortalState(portal);
    } catch (err) {
      console.warn("[use-auth] Could not refresh portal state:", err);
      setPendingApplications([]);
    }
  };

  useEffect(() => {
    let active = true;

    const syncSession = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setRoles([]);
        setPendingApplications([]);
        setActivePortalState("tenant");
        setLoading(false);
        return;
      }

      const nextRoles = await fetchUserRoles(s.user.id);
      if (!active) return;
      setRoles(nextRoles);
      await refreshPortalState(s.user.id);
      if (!active) return;
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED") {
        void syncSession(s);
        return;
      }
      setLoading(true);
      setTimeout(() => {
        void syncSession(s);
      }, 0);
    });

    setLoading(true);
    supabase.auth.getSession().then(({ data: { session: s } }) => void syncSession(s));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const roleSet = useMemo(() => new Set(roles), [roles]);
  const hasApprovedRole = (role: AppRole) => roleSet.has(role);

  const setActivePortalChoice = async (portal: PortalId) => {
    await setActivePortal({ data: { portal } });
    setActivePortalState(portal);
  };

  const signOut = async () => {
    clearCaretakerToken();
    await supabase.auth.signOut();
    globalThis.location.href = "/tenant";
  };

  return (
    <Ctx.Provider
      value={{
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
        refreshPortalState: async () => refreshPortalState(user?.id),
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
