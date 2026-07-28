import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmModuleSubscribePage } from "@/components/pm/PmModuleSubscribePage";

export const Route = createFileRoute("/agency/manage/subscribe")({
  head: () => ({ meta: [{ title: "Add Property Management — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PmModuleSubscribePage portal="agency" />
    </AgencyShell>
  ),
});
