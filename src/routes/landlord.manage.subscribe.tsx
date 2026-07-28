import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmModuleSubscribePage } from "@/components/pm/PmModuleSubscribePage";

export const Route = createFileRoute("/landlord/manage/subscribe")({
  head: () => ({ meta: [{ title: "Add Property Management — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PmModuleSubscribePage portal="landlord" />
    </LandlordShell>
  ),
});
