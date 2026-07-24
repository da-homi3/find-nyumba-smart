import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmPropertyNewPage } from "@/components/pm/PmPropertyNewPage";

export const Route = createFileRoute("/manager/manage/new")({
  head: () => ({ meta: [{ title: "New managed property — Manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PmPropertyNewPage portal="manager" />
    </ManagerShell>
  ),
});
