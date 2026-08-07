import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, loading, rolesReady } = useAuth();
  const navigate = useNavigate();
  const authSettled = !loading && rolesReady;

  useEffect(() => {
    if (!authSettled) return;
    if (!user || !isAdmin) {
      navigate({ to: "/auth", replace: true });
    }
  }, [authSettled, user, isAdmin, navigate]);

  if (!authSettled || !user || !isAdmin) {
    // Keep the tree mounted once we already know this is an admin — mid-session
    // auth re-emits (Android WebView) must not unmount upload wizards.
    if (!(user && isAdmin)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
