import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PortalImportPage } from "@/components/dashboard/portal/PortalImportPage";

export const Route = createFileRoute("/landlord/import")({
  head: () => ({ meta: [{ title: "Bulk import — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PortalImportPage portal="landlord" />
    </LandlordShell>
  ),
});
