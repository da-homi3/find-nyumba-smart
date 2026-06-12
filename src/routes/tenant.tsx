import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AiAssistant } from "@/components/AiAssistant";
import { TenantBottomNav } from "@/components/TenantBottomNav";

export const Route = createFileRoute("/tenant")({
  component: TenantLayout,
});

function TenantLayout() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />
      <AiAssistant />
      <TenantBottomNav />
    </div>
  );
}
