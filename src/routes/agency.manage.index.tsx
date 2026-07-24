import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmPropertyListPage } from "@/components/pm/PmPropertyListPage";

export const Route = createFileRoute("/agency/manage/")({
  head: () => ({ meta: [{ title: "Manage portfolio — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PmPropertyListPage portal="agency" />
    </AgencyShell>
  ),
});
