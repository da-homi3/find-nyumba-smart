import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/landlord")({
  component: LandlordLayout,
});

function LandlordLayout() {
  const { user, loading, isLandlord } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The landlord portal entry (/landlord) is public — it hosts the
  // landlord sign-in / sign-up flow. Only gate nested landlord routes.
  const isPublicEntry = pathname === "/landlord" || pathname === "/landlord/";

  useEffect(() => {
    if (isPublicEntry || loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: pathname } as never, replace: true });
      return;
    }
    if (!isLandlord) {
      navigate({ to: "/settings", replace: true });
    }
  }, [loading, user, isLandlord, isPublicEntry, pathname, navigate]);

  if (!isPublicEntry && (loading || !user || !isLandlord)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
