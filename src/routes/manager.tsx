import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/manager")({
  component: ManagerLayout,
});

function ManagerLayout() {
  const { user, loading, isManager, pendingApplications } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPublicEntry = pathname === "/manager" || pathname === "/manager/";

  useEffect(() => {
    if (isPublicEntry || loading) return;
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: pathname, role: "manager", mode: "signin" },
        replace: true,
      });
      return;
    }
    if (!isManager) {
      const pending = hasPendingApplicationForRole(pendingApplications, "manager");
      navigate({
        to: pending ? "/auth/pending" : "/auth",
        search: pending
          ? undefined
          : { redirect: pathname, role: "manager", mode: "signup" },
        replace: true,
      });
    }
  }, [loading, user, isManager, pendingApplications, isPublicEntry, pathname, navigate]);

  if (!isPublicEntry && (loading || !user || !isManager)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
