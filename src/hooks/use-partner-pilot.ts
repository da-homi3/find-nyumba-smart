import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getPilotPartnership, listMyPilots } from "@/lib/api/pilot-partnership.functions";

/** Prefer ACTIVE / EXTENDED / ONBOARDING, else newest pilot. */
export function pickActivePilotId(
  pilots: Array<{ id: string; status: string }> | undefined,
): string | undefined {
  if (!pilots?.length) return undefined;
  const preferred = pilots.find((p) =>
    ["ACTIVE", "EXTENDED", "ONBOARDING", "APPROVED"].includes(p.status),
  );
  return preferred?.id ?? pilots[0]?.id;
}

export function useMyPilots() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-pilots", user?.id],
    enabled: !!user,
    queryFn: () => listMyPilots(),
  });
}

export function useActivePilotId() {
  const pilotsQuery = useMyPilots();
  const pilotId = pickActivePilotId(pilotsQuery.data);
  return { ...pilotsQuery, pilotId };
}

export function usePilotDetail(pilotId: string | undefined) {
  return useQuery({
    queryKey: ["pilot-detail", pilotId],
    enabled: !!pilotId,
    queryFn: () => getPilotPartnership({ data: { pilotId: pilotId! } }),
  });
}
