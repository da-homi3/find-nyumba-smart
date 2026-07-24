import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmPropertyNewPage } from "@/components/pm/PmPropertyNewPage";

export const Route = createFileRoute("/agency/manage/new")({
  head: () => ({ meta: [{ title: "New managed property — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PmPropertyNewPage portal="agency" />
    </AgencyShell>
  ),
});
