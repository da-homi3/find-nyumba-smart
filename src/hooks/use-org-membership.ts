import { useQuery } from "@tanstack/react-query";
import { getMyOrgMembership } from "@/lib/api/nyumba.functions";
import { useAuth } from "@/hooks/use-auth";

export function useOrgMembership() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["org-membership", user?.id],
    enabled: !!user,
    queryFn: () => getMyOrgMembership(),
    staleTime: 30_000,
  });

  const membership = query.data ?? null;
  // Solo manager/agency accounts have no org row yet — treat them as owners so
  // tools (import, API, plan, billing) match the landlord dashboard.
  const isOwner = membership ? membership.isOwner : !query.isLoading && !!user;
  const isMember = membership?.isMember ?? false;
  const isPending = membership?.isPending ?? false;
  return {
    membership,
    isOwner,
    isMember,
    isPending,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
