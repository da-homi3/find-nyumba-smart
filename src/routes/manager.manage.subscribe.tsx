import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmModuleSubscribePage } from "@/components/pm/PmModuleSubscribePage";

export const Route = createFileRoute("/manager/manage/subscribe")({
  head: () => ({ meta: [{ title: "Add Property Management — Manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PmModuleSubscribePage portal="manager" />
    </ManagerShell>
  ),
});
