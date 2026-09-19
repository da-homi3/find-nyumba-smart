import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createPortalBeforeLoad } from "@/lib/route-guards/create-portal-before-load";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: createPortalBeforeLoad("admin"),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, loading, rolesReady, rolesError, refreshPortalState } = useAuth();
  const navigate = useNavigate();
  const authSettled = !loading && rolesReady;

  useEffect(() => {
    if (!authSettled || rolesError) return;
    if (!user || !isAdmin) {
      navigate({ to: "/auth", replace: true });
    }
  }, [authSettled, user, isAdmin, navigate, rolesError]);

  if (!authSettled || !user || !isAdmin || rolesError) {
    if (!(user && isAdmin) || rolesError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
          {rolesError ? (
            <>
              <p className="text-sm text-muted-foreground">Couldn’t verify admin access.</p>
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => void refreshPortalState()}
              >
                Retry
              </button>
            </>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
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
