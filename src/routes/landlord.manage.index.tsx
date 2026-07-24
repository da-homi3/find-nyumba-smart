import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmPropertyListPage } from "@/components/pm/PmPropertyListPage";

export const Route = createFileRoute("/landlord/manage/")({
  head: () => ({ meta: [{ title: "Manage portfolio — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PmPropertyListPage portal="landlord" />
    </LandlordShell>
  ),
});
