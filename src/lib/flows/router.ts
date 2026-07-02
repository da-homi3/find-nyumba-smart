import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  handlePersonalAssistantCommand,
  showPersonalHome,
} from "@/lib/flows/assistant";
import { handleLandlordFlow } from "@/lib/flows/landlord";
import { handleProviderFlow } from "@/lib/flows/provider";
import { handleTenantFlow } from "@/lib/flows/tenant";
import { markRead, sendButtons, sendText } from "@/lib/whatsapp/client";
import { notifyWelcome } from "@/lib/whatsapp/templates";
import { clearSession, getSession, saveSession, updateState } from "@/lib/whatsapp/session";
import type { WaInboundMessage, WaSession } from "@/lib/whatsapp/types";
import {
  displayFirstName,
  hydrateSessionFromProfile,
  inferPrimaryWaRole,
  type UserAssistantProfile,
} from "@/lib/whatsapp/user-profile";

type Admin = SupabaseClient<Database>;

const ROLE_BUTTONS = [
  { id: "role_tenant", label: "🔍 Find a home" },
  { id: "role_landlord", label: "🏠 List property" },
  { id: "role_provider", label: "🔧 Services" },
] as const;

async function sendHelpMenu(admin: Admin, waPhone: string): Promise<void> {
  await sendText(
    waPhone,
    "*NyumbaSearch — your personal assistant*\n\n• *MENU* — your personalised home\n• *STATUS* — account summary\n• *HELP* — this message\n• *STOP* — unsubscribe\n\nnyumbasearch.com",
    admin,
  );
}

function buildOnboardingGreeting(profile: UserAssistantProfile | null): string {
  if (!profile) {
    return "Welcome to *NyumbaSearch* 🏠\n\nKenya's verified property platform.\n\nI'll be your personal rental assistant once you link your account.";
  }
  if (profile.firstName) {
    return `Welcome back, *${profile.firstName}*! 🏠\n\nI'm your personal NyumbaSearch assistant.`;
  }
  return "Welcome back! 🏠\n\nI'm your personal NyumbaSearch assistant.";
}

async function showStartOnboarding(
  admin: Admin,
  waPhone: string,
  profile: UserAssistantProfile | null,
  senderName: string,
): Promise<void> {
  const firstName = displayFirstName(profile, senderName);
  try {
    await notifyWelcome(waPhone, firstName);
  } catch {
    // Template may not be approved yet
  }

  const greeting = buildOnboardingGreeting(profile);
  await sendButtons(waPhone, `${greeting}\n\nHow can I help?`, [...ROLE_BUTTONS], admin);
  await updateState(admin, waPhone, "awaiting_role");
}

async function handleAwaitingRole(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  message: WaInboundMessage,
  input: string,
  profile: UserAssistantProfile | null,
): Promise<void> {
  if (input === "role_tenant") {
    session.role = "tenant";
    session.state = "tenant_menu";
    await saveSession(admin, session);
    await handleTenantFlow(admin, waPhone, senderName, session, message, "tenant_menu", profile);
    return;
  }

  if (input === "role_landlord") {
    session.role = profile
      ? inferPrimaryWaRole(profile.roles, {
          hasProviderProfile: Boolean(profile.providerBusiness),
          hasListings: profile.activeListings + profile.pendingListings > 0,
        })
      : "landlord";
    if (session.role === "provider") session.role = "landlord";
    session.state = "landlord_menu";
    await saveSession(admin, session);
    await handleLandlordFlow(admin, waPhone, senderName, session, message, "landlord_menu", profile);
    return;
  }

  if (input === "role_provider") {
    session.role = "provider";
    session.state = "provider_menu";
    await saveSession(admin, session);
    await handleProviderFlow(admin, waPhone, senderName, session, message, "provider_menu", profile);
    return;
  }

  await sendButtons(waPhone, "Please choose:", [...ROLE_BUTTONS], admin);
}

async function handleOnboarding(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  message: WaInboundMessage,
  input: string,
): Promise<void> {
  const profile = await hydrateSessionFromProfile(admin, session, senderName);

  if (profile && (session.state === "start" || session.state === "awaiting_role")) {
    await showPersonalHome(admin, waPhone, session, profile, senderName, message);
    return;
  }

  if (session.state === "start") {
    await showStartOnboarding(admin, waPhone, profile, senderName);
    return;
  }

  if (session.state === "awaiting_role") {
    await handleAwaitingRole(admin, waPhone, senderName, session, message, input, profile);
    return;
  }

  if (session.state === "personal_home" && profile) {
    const handled = await handlePersonalAssistantCommand(
      admin, waPhone, session, profile, senderName, message, input,
    );
    if (handled) return;
  }

  await handleOnboarding(admin, waPhone, senderName, { ...session, state: "start" }, message, "");
}

async function handleGlobalCommands(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  message: WaInboundMessage,
  input: string,
  profile: UserAssistantProfile | null,
): Promise<boolean> {
  const lower = input.toLowerCase();

  if (lower === "start") {
    session.state = profile ? "personal_home" : "start";
    session.context = profile ? { profile, profileCachedAt: Date.now() } : {};
    await saveSession(admin, session);
    if (profile) {
      await showPersonalHome(admin, waPhone, session, profile, senderName, message);
      return true;
    }
    return false;
  }

  if (lower === "menu" || lower === "home") {
    if (profile) {
      await showPersonalHome(admin, waPhone, session, profile, senderName, message);
      return true;
    }
    session.state = "start";
    session.context = {};
    await saveSession(admin, session);
    await handleOnboarding(admin, waPhone, senderName, session, message, "");
    return true;
  }

  if (lower === "stop" || lower === "quit") {
    await clearSession(admin, waPhone);
    await sendText(waPhone, "Unsubscribed. Reply *START* to re-subscribe.", admin);
    return true;
  }

  if (lower === "help") {
    await sendHelpMenu(admin, waPhone);
    return true;
  }

  return false;
}

export async function routeMessage(
  admin: Admin,
  waPhone: string,
  senderName: string,
  message: WaInboundMessage,
): Promise<void> {
  const session = await getSession(admin, waPhone);

  if (message.id) await markRead(message.id);

  const input = message.interactiveId || message.text || "";
  const profile = await hydrateSessionFromProfile(admin, session, senderName);

  if (await handleGlobalCommands(admin, waPhone, senderName, session, message, input, profile)) {
    return;
  }

  if (profile) {
    const handled = await handlePersonalAssistantCommand(
      admin, waPhone, session, profile, senderName, message, input,
    );
    if (handled) return;
  }

  if (session.state === "personal_home" && profile) {
    const handled = await handlePersonalAssistantCommand(
      admin, waPhone, session, profile, senderName, message, input,
    );
    if (handled) return;
  }

  switch (session.role) {
    case "tenant":
      await handleTenantFlow(admin, waPhone, senderName, session, message, input, profile);
      break;
    case "landlord":
    case "agent":
      await handleLandlordFlow(admin, waPhone, senderName, session, message, input, profile);
      break;
    case "provider":
      await handleProviderFlow(admin, waPhone, senderName, session, message, input, profile);
      break;
    default:
      await handleOnboarding(admin, waPhone, senderName, session, message, input);
  }
}
