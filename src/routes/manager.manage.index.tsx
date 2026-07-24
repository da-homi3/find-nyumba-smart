import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmPropertyListPage } from "@/components/pm/PmPropertyListPage";

export const Route = createFileRoute("/manager/manage/")({
  head: () => ({ meta: [{ title: "Manage portfolio — Manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PmPropertyListPage portal="manager" />
    </ManagerShell>
  ),
});
