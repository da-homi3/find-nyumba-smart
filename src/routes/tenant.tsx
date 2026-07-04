import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { AiAssistant } from "@/components/AiAssistant";
import { TenantBottomNav } from "@/components/TenantBottomNav";

export const Route = createFileRoute("/tenant")({
  component: TenantLayout,
});

function TenantLayout() {
  const matchRoute = useMatchRoute();
  const isMessageThread = Boolean(matchRoute({ to: "/tenant/messages/$id", fuzzy: false }));

  return (
    <div className={`min-h-screen bg-background ${isMessageThread ? "" : "pb-24"}`}>
      <Outlet />
      {!isMessageThread && <AiAssistant />}
      {!isMessageThread && <TenantBottomNav />}
    </div>
  );
}
