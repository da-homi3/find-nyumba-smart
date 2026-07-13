import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { setAdminPropertyVerification } from "@/lib/api/admin.functions";
import { isDemoListingId } from "@/data/mockListings";
import { useAuth } from "@/hooks/use-auth";
import type { Property } from "@/lib/properties";

function VerifyButtonIcon({
  pending,
  isVerified,
}: Readonly<{ pending: boolean; isVerified: boolean }>) {
  if (pending) return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />;
  if (isVerified) return <ShieldOff className="h-3.5 w-3.5" aria-hidden />;
  return <ShieldCheck className="h-3.5 w-3.5" aria-hidden />;
}

export function AdminPropertyVerifyButton({ property }: Readonly<{ property: Property }>) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (verified: boolean) =>
      setAdminPropertyVerification({ data: { propertyId: property.id, verified } }),
    onSuccess: (_row, verified) => {
      toast.success(verified ? "Property verified" : "Verification removed");
      void qc.invalidateQueries({ queryKey: ["property", property.id] });
      void qc.invalidateQueries({ queryKey: ["admin-properties"] });
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin || isDemoListingId(property.id)) return null;

  const pending = mutation.isPending;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => mutation.mutate(!property.is_verified)}
      className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
    >
      <VerifyButtonIcon pending={pending} isVerified={property.is_verified} />
      {property.is_verified ? "Remove verification" : "Verify listing"}
    </button>
  );
}
