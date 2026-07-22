import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isKenyanPhone, normalizeKenyanPhoneLocal, resolveAccountPhone } from "@/lib/phone";
import { withTimeout } from "@/lib/auth/with-timeout";

export const profilePhoneQueryKey = (userId: string) => ["profile-phone", userId] as const;

async function fetchProfilePhone(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.phone?.trim() || null;
}

/** Account phone from profiles (+ auth metadata fallback). */
export function useProfilePhone() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: profilePhoneQueryKey(user?.id ?? ""),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const profilePhone = await withTimeout(fetchProfilePhone(user!.id), 4000, null);
      return resolveAccountPhone(user, profilePhone) || null;
    },
  });

  const phone = query.data ?? (resolveAccountPhone(user) || null);
  const hasPhone = Boolean(phone && isKenyanPhone(phone));

  return {
    phone,
    hasPhone,
    loading: authLoading || (Boolean(user) && query.isLoading),
    refetch: query.refetch,
  };
}

/** Persist phone on profiles + auth metadata. */
export async function saveAccountPhone(userId: string, rawPhone: string): Promise<string> {
  const phone = normalizeKenyanPhoneLocal(rawPhone);
  if (!phone) {
    throw new Error("Enter a valid Kenyan mobile number (07XX XXX XXX)");
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, phone }, { onConflict: "id" });
  if (error) throw error;

  const { error: metaError } = await supabase.auth.updateUser({
    data: { phone },
  });
  if (metaError) throw metaError;

  return phone;
}

export function useSaveAccountPhone() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return async (rawPhone: string) => {
    if (!user) throw new Error("Sign in to save your phone number");
    const phone = await saveAccountPhone(user.id, rawPhone);
    // Optimistic cache is enough for the phone gate — no refetch required.
    qc.setQueryData(profilePhoneQueryKey(user.id), phone);
    return phone;
  };
}
