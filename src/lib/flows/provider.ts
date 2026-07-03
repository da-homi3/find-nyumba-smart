import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSiteUrl } from "@/lib/site";
import { sendAccountStatus } from "@/lib/flows/assistant";
import { sendButtons, sendList, sendText } from "@/lib/whatsapp/client";
import { updateState } from "@/lib/whatsapp/session";
import type { WaInboundMessage, WaSession } from "@/lib/whatsapp/types";
import {
  displayFirstName,
  formatProfileDigest,
  type UserAssistantProfile,
} from "@/lib/whatsapp/user-profile";

type Admin = SupabaseClient<Database>;

export async function handleProviderFlow(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  _message: WaInboundMessage,
  input: string,
  profile?: UserAssistantProfile | null,
): Promise<void> {
  const firstName = displayFirstName(profile ?? null, senderName);

  if (input === "my_status" && profile) {
    await sendAccountStatus(admin, waPhone, profile);
    return;
  }

  if (session.state === "provider_menu" || input === "provider_menu") {
    if (profile?.providerBusiness) {
      const intro = formatProfileDigest(profile);
      await sendList(
        waPhone,
        `${intro}\n\n*${profile.providerBusiness}* — your provider assistant:`,
        "Menu",
        [
          {
            title: "Provider",
            rows: [
              {
                id: "provider_profile",
                title: "My profile",
                description: profile.providerTier ?? "basic",
              },
              { id: "provider_inquiries", title: "Inquiries", description: "View on dashboard" },
              { id: "my_status", title: "Account", description: "Full summary" },
              { id: "switch_role", title: "Switch role", description: "Tenant or landlord" },
            ],
          },
        ],
        admin,
      );
    } else {
      await sendButtons(
        waPhone,
        `Hi ${firstName} 🔧\n\nService provider options:`,
        [
          { id: "provider_profile", label: "👤 My profile" },
          { id: "provider_inquiries", label: "📥 Inquiries" },
          { id: "provider_register", label: "➕ Register" },
        ],
        admin,
      );
    }
    await updateState(admin, waPhone, "provider_menu");
    return;
  }

  if (input === "provider_register") {
    await sendText(
      waPhone,
      `Register as a service provider on NyumbaSearch:\n\n${getSiteUrl()}/services/register\n\nMovers, cleaners, plumbers & more.`,
      admin,
    );
    return;
  }

  if (input === "provider_profile" || input === "provider_inquiries") {
    const userId =
      profile?.userId ??
      (await admin.from("profiles").select("id").eq("phone", waPhone).maybeSingle()).data?.id;

    if (!userId) {
      await sendText(waPhone, "Link your account in Settings first, then return here.", admin);
      return;
    }

    const { data: provider } = await admin
      .from("service_providers")
      .select("business_name, status, tier")
      .eq("user_id", userId)
      .maybeSingle();

    if (!provider) {
      await sendButtons(
        waPhone,
        "No provider profile found.",
        [{ id: "provider_register", label: "➕ Register" }],
        admin,
      );
      return;
    }

    if (input === "provider_profile") {
      await sendText(
        waPhone,
        `👤 *${provider.business_name}*\nStatus: ${provider.status}\nTier: ${provider.tier}\n\n${getSiteUrl()}/services/provider/dashboard`,
        admin,
      );
      return;
    }

    await sendText(
      waPhone,
      `📥 Check inquiries on your provider dashboard:\n${getSiteUrl()}/services/provider/dashboard`,
      admin,
    );
    return;
  }

  await sendButtons(
    waPhone,
    "Provider menu:",
    [
      { id: "provider_profile", label: "👤 Profile" },
      { id: "provider_register", label: "➕ Register" },
      { id: "provider_menu", label: "🏠 Menu" },
    ],
    admin,
  );
}
