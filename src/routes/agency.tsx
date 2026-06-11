import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/agency")({
  component: AgencyLayout,
});

function AgencyLayout() {
  const { user, loading, isAgency } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPublicEntry = pathname === "/agency" || pathname === "/agency/";

  useEffect(() => {
    if (isPublicEntry || loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
      return;
    }
    if (!isAgency) {
      navigate({ to: "/settings", replace: true });
    }
  }, [loading, user, isAgency, isPublicEntry, pathname, navigate]);

  if (!isPublicEntry && (loading || !user || !isAgency)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
