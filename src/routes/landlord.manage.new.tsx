import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmPropertyNewPage } from "@/components/pm/PmPropertyNewPage";

export const Route = createFileRoute("/landlord/manage/new")({
  head: () => ({ meta: [{ title: "New managed property — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PmPropertyNewPage portal="landlord" />
    </LandlordShell>
  ),
});
