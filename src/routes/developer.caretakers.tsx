import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PortalCaretakersPage } from "@/components/dashboard/portal/PortalCaretakersPage";

export const Route = createFileRoute("/developer/caretakers")({
  head: () => ({ meta: [{ title: "Caretakers — Developer — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <PortalCaretakersPage portal="property_developer" />
    </DeveloperShell>
  ),
});
