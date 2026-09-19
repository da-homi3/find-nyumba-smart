import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PortalImportPage } from "@/components/dashboard/portal/PortalImportPage";

export const Route = createFileRoute("/developer/import")({
  head: () => ({ meta: [{ title: "Bulk import — Developer — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <PortalImportPage portal="property_developer" />
    </DeveloperShell>
  ),
});
