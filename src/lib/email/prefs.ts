import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export async function getEmailPrefs(admin: Admin, userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("email_marketing_opt_in, email_message_opt_in, email_transactional_opt_in")
    .eq("id", userId)
    .maybeSingle();

  return {
    marketing: data?.email_marketing_opt_in !== false,
    messages: data?.email_message_opt_in !== false,
    transactional: data?.email_transactional_opt_in !== false,
  };
}

export async function shouldSendMessageEmail(admin: Admin, recipientId: string): Promise<boolean> {
  const prefs = await getEmailPrefs(admin, recipientId);
  return prefs.messages;
}

export async function shouldSendMarketingEmail(admin: Admin, userId: string): Promise<boolean> {
  const prefs = await getEmailPrefs(admin, userId);
  return prefs.marketing;
}
