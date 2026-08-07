import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/agency")({
  component: AgencyLayout,
});

function AgencyLayout() {
  const { user, loading, rolesReady, isAgency, pendingApplications } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPublicEntry = pathname === "/agency" || pathname === "/agency/";
  const authSettled = !loading && rolesReady;

  useEffect(() => {
    if (isPublicEntry || !authSettled) return;
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: pathname, signupFor: "agency", mode: "signin" },
        replace: true,
      });
      return;
    }
    if (!isAgency) {
      const pending = hasPendingApplicationForRole(pendingApplications, "agency");
      navigate({
        to: pending ? "/auth/pending" : "/auth",
        search: pending ? undefined : { redirect: pathname, signupFor: "agency", mode: "signup" },
        replace: true,
      });
    }
  }, [authSettled, user, isAgency, pendingApplications, isPublicEntry, pathname, navigate]);

  if (!isPublicEntry && (!authSettled || !user || !isAgency)) {
    if (!(user && isAgency)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
  }

  return <Outlet />;
}
