import { useQuery } from "@tanstack/react-query";
import { getUserEntitlements } from "@/lib/api/revenue.functions";
import { DEFAULT_ENTITLEMENTS, isPlusMember } from "@/lib/revenue/entitlements";
import { useAuth } from "@/hooks/use-auth";

export function useEntitlements() {
  const { user, isAdmin } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["entitlements", user?.id],
    enabled: !!user,
    queryFn: () => getUserEntitlements(),
  });

  const entitlements = data ?? DEFAULT_ENTITLEMENTS;
  const plus = isPlusMember(entitlements) || isAdmin;

  return { entitlements, isPlus: plus, loading: !!user && isLoading };
}
