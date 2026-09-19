import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { listMyPilots } from "@/lib/api/pilot-partnership.functions";

export const Route = createFileRoute("/partner")({
  component: PartnerLayout,
});

function PartnerLayout() {
  const { user, loading, rolesReady, rolesError, refreshPortalState } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isInvitePath = pathname.startsWith("/partner/invite");
  const authSettled = !loading && rolesReady;

  const pilotsQuery = useQuery({
    queryKey: ["my-pilots", user?.id],
    enabled: !!user && authSettled && !isInvitePath && !rolesError,
    queryFn: () => listMyPilots(),
    retry: 2,
  });

  useEffect(() => {
    if (isInvitePath) return;
    if (!authSettled) return;
    if (rolesError) return;
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: pathname, mode: "signin" },
        replace: true,
      });
      return;
    }
    if (pilotsQuery.isLoading || pilotsQuery.isFetching || pilotsQuery.isError) return;
    if (pilotsQuery.isSuccess && pilotsQuery.data.length === 0) {
      navigate({ to: "/", replace: true });
    }
  }, [
    authSettled,
    user,
    isInvitePath,
    pathname,
    navigate,
    rolesError,
    pilotsQuery.isLoading,
    pilotsQuery.isFetching,
    pilotsQuery.isError,
    pilotsQuery.isSuccess,
    pilotsQuery.data,
  ]);

  if (isInvitePath) {
    return <Outlet />;
  }

  if (!authSettled || !user || rolesError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
        {rolesError ? (
          <>
            <p className="text-sm text-muted-foreground">Couldn’t load your partner session.</p>
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

  if (pilotsQuery.isLoading || pilotsQuery.isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pilotsQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
        <p className="text-sm text-muted-foreground">Couldn’t load your pilot dashboard.</p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => void pilotsQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!pilotsQuery.isSuccess || pilotsQuery.data.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
