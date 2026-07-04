import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalCaretakersPage } from "@/components/dashboard/portal/PortalCaretakersPage";

export const Route = createFileRoute("/manager/caretakers")({
  head: () => ({ meta: [{ title: "Caretakers — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PortalCaretakersPage portal="manager" />
    </ManagerShell>
  ),
});
