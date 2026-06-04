import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TenantBottomNav } from "@/components/TenantBottomNav";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";


export const Route = createFileRoute("/tenant")({
  component: TenantLayout,
});

function TenantLayout() {
  const { loading } = useAuth();

  if (loading) {
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

