import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/landlord/leads")({
  component: () => (
    <LandlordShell>
      <div className="px-6 py-8 lg:px-10">
        <h1 className="font-display text-3xl font-semibold">Leads</h1>
        <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No leads yet. Tenant inquiries land here in real time.
          </p>
        </div>
      </div>
    </LandlordShell>
  ),
});
