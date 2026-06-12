import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/manager")({
  component: ManagerLayout,
});

function ManagerLayout() {
  const { user, loading, isManager } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPublicEntry = pathname === "/manager" || pathname === "/manager/";

  useEffect(() => {
    if (isPublicEntry || loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
      return;
    }
    if (!isManager) {
      navigate({ to: "/settings", replace: true });
    }
  }, [loading, user, isManager, isPublicEntry, pathname, navigate]);

  if (!isPublicEntry && (loading || !user || !isManager)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
