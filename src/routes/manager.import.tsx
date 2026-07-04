import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalImportPage } from "@/components/dashboard/portal/PortalImportPage";

export const Route = createFileRoute("/manager/import")({
  head: () => ({ meta: [{ title: "Bulk import — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PortalImportPage portal="manager" />
    </ManagerShell>
  ),
});
