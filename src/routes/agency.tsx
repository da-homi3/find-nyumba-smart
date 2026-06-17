import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/agency")({
  component: AgencyLayout,
});

function AgencyLayout() {
  const { user, loading, isAgency, pendingApplications } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPublicEntry = pathname === "/agency" || pathname === "/agency/";

  useEffect(() => {
    if (isPublicEntry || loading) return;
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: pathname, role: "agency", mode: "signin" },
        replace: true,
      });
      return;
    }
    if (!isAgency) {
      const pending = hasPendingApplicationForRole(pendingApplications, "agency");
      navigate({
        to: pending ? "/auth/pending" : "/auth",
        search: pending ? undefined : { redirect: pathname, role: "agency", mode: "signup" },
        replace: true,
      });
    }
  }, [loading, user, isAgency, pendingApplications, isPublicEntry, pathname, navigate]);

  if (!isPublicEntry && (loading || !user || !isAgency)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
