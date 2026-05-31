import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/landlord/analytics")({
  component: () => (
    <LandlordShell>
      <div className="px-6 py-8 lg:px-10">
        <h1 className="font-display text-3xl font-semibold">Analytics</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {["Views over time", "Lead funnel", "Vacancy duration"].map((t) => (
            <div key={t} className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold">{t}</h3>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-6 h-32 rounded-xl bg-gradient-to-tr from-secondary to-accent" />
              <p className="mt-3 text-xs text-muted-foreground">Detailed insights coming soon.</p>
            </div>
          ))}
        </div>
      </div>
    </LandlordShell>
  ),
});
