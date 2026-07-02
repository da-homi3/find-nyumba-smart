import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/landlord")({
  component: LandlordLayout,
});

function LandlordLayout() {
  const { user, loading, isLandlord, pendingApplications } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isPublicEntry = pathname === "/landlord" || pathname === "/landlord/";

  useEffect(() => {
    if (isPublicEntry || loading) return;
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: pathname, mode: "signin" },
        replace: true,
      });
      return;
    }
    if (!isLandlord) {
      const pending = hasPendingApplicationForRole(pendingApplications, "landlord");
      navigate({
        to: pending ? "/auth/pending" : "/auth",
        search: pending ? undefined : { redirect: pathname, signupFor: "landlord", mode: "signup" },
        replace: true,
      });
    }
  }, [loading, user, isLandlord, pendingApplications, isPublicEntry, pathname, navigate]);

  if (!isPublicEntry && (loading || !user || !isLandlord)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
