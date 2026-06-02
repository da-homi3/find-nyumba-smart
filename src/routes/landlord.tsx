import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/landlord")({
  component: LandlordLayout,
});

function LandlordLayout() {
  const { user, loading, isLandlord } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/landlord" } as never, replace: true });
      return;
    }
    if (!isLandlord) {
      navigate({ to: "/tenant", replace: true });
    }
  }, [loading, user, isLandlord, navigate]);

  if (loading || !user || !isLandlord) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
