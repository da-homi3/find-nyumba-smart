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
  return {
    membership,
    isOwner: membership?.isOwner ?? false,
    isMember: membership?.isMember ?? false,
    isPending: membership?.isPending ?? false,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
