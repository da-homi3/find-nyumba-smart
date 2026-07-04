import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PortalCaretakersPage } from "@/components/dashboard/portal/PortalCaretakersPage";

export const Route = createFileRoute("/landlord/caretakers")({
  head: () => ({ meta: [{ title: "Caretakers — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PortalCaretakersPage portal="landlord" />
    </LandlordShell>
  ),
});
