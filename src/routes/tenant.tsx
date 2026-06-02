import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TenantBottomNav } from "@/components/TenantBottomNav";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/tenant")({
  component: TenantLayout,
});

function TenantLayout() {
  const { user, roles, loading, isLandlord } = useAuth();
  const navigate = useNavigate();
  const blocked = !loading && user && isLandlord && !roles.includes("tenant");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/tenant" } as never, replace: true });
      return;
    }
    if (blocked) {
      navigate({ to: "/landlord/dashboard", replace: true });
    }
  }, [loading, user, blocked, navigate]);

  if (loading || !user || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />
      <TenantBottomNav />
    </div>
  );
}
