import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPendingApplicationForRole } from "@/lib/portal-guard";
import { createPortalBeforeLoad } from "@/lib/route-guards/create-portal-before-load";
import { SectorAmbientBackground } from "@/components/SectorAmbientBackground";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/landlord")({
  beforeLoad: createPortalBeforeLoad("landlord"),
  component: LandlordLayout,
});

function LandlordLayout() {
  const { user, loading, rolesReady, rolesError, isLandlord, pendingApplications, refreshPortalState } =
    useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isPublicEntry = pathname === "/landlord" || pathname === "/landlord/";
  const authSettled = !loading && rolesReady;

  useEffect(() => {
    if (isPublicEntry || !authSettled || rolesError) return;
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
  }, [
    authSettled,
    user,
    isLandlord,
    pendingApplications,
    isPublicEntry,
    pathname,
    navigate,
    rolesError,
  ]);

  if (!isPublicEntry && (!authSettled || !user || !isLandlord || rolesError)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
        {rolesError ? (
          <>
            <p className="text-sm text-muted-foreground">Couldn’t verify your landlord access.</p>
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

  return (
    <div className="relative min-h-screen">
      <SectorAmbientBackground sector="landlord" />
      <div className="relative z-10">
        <Outlet />
      </div>
    </div>
  );
}
