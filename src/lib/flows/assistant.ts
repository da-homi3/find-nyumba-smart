import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSiteUrl } from "@/lib/site";
import { handleLandlordFlow } from "@/lib/flows/landlord";
import { handleProviderFlow } from "@/lib/flows/provider";
import { handleTenantFlow } from "@/lib/flows/tenant";
import { sendButtons, sendList, sendText } from "@/lib/whatsapp/client";
import {
  availableWaRoles,
  displayFirstName,
  formatProfileDigest,
  type UserAssistantProfile,
} from "@/lib/whatsapp/user-profile";
import { updateState } from "@/lib/whatsapp/session";
import type { WaInboundMessage, WaSession, WaRole } from "@/lib/whatsapp/types";

type Admin = SupabaseClient<Database>;

const ROLE_LABELS: Record<WaRole, string> = {
  unknown: "Home",
  tenant: "🔍 Tenant — find a home",
  landlord: "🏠 Landlord — manage listings",
  agent: "🏢 Agency — manage listings",
  provider: "🔧 Service provider",
};

export async function sendSavedHomes(
  admin: Admin,
  waPhone: string,
  profile: UserAssistantProfile,
): Promise<void> {
  if (profile.savedHomes.length === 0) {
    await sendButtons(waPhone, "You haven't saved any homes yet.", [
      { id: "search_start", label: "🔍 Search homes" },
      { id: "tenant_menu", label: "🏠 Menu" },
    ], admin);
    return;
  }

  await sendText(
    waPhone,
    `❤️ *Your saved homes* (${profile.savedCount}):\n\n${profile.savedHomes
      .map((h, i) => `${i + 1}. *${h.title}*\n   ${h.neighborhood} · KES ${h.rentKes.toLocaleString()}/mo`)
      .join("\n\n")}`,
    admin,
  );

  for (const h of profile.savedHomes.slice(0, 3)) {
    await sendButtons(waPhone, h.title, [
      { id: `view_${h.id}`, label: "👁 View" },
      { id: `unlock_${h.id}`, label: "📞 Contact" },
    ], admin);
  }

  await sendText(waPhone, `See all saved: ${getSiteUrl()}/tenant/saved`, admin);
}

export async function sendMyViewings(
  admin: Admin,
  waPhone: string,
  profile: UserAssistantProfile,
): Promise<void> {
  if (profile.upcomingViewings.length === 0) {
    await sendText(waPhone, "No upcoming viewings. Search homes and book a viewing!", admin);
    return;
  }

  const body = profile.upcomingViewings
    .map((v) => {
      const when = new Date(v.scheduledAt).toLocaleString("en-KE", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `• *${v.title}*\n  ${when} — ${v.status}`;
    })
    .join("\n\n");

  await sendText(waPhone, `📅 *Your upcoming viewings:*\n\n${body}`, admin);
}

export async function sendAccountStatus(
  admin: Admin,
  waPhone: string,
  profile: UserAssistantProfile,
): Promise<void> {
  const lines = [
    `👤 *${profile.fullName}*`,
    profile.email ? `📧 ${profile.email}` : null,
    `Plan: ${profile.isPlus ? "Plus ✨" : profile.tenantPlan}`,
    profile.trialActive
      ? `Trial unlocks: ${profile.trialUnlocksRemaining}`
      : null,
    profile.landlordPlan === "free" ? null : `Landlord plan: ${profile.landlordPlan}`,
    `Saved homes: ${profile.savedCount}`,
    `Contact unlocks: ${profile.recentUnlockCount}`,
    profile.totalLeads > 0 ? `Listing leads: ${profile.totalLeads}` : null,
    `\n${getSiteUrl()}/settings`,
  ].filter(Boolean);

  await sendText(waPhone, lines.join("\n"), admin);
}

export async function sendRoleSwitcher(
  admin: Admin,
  waPhone: string,
  profile: UserAssistantProfile,
  session: WaSession,
): Promise<void> {
  const roles = availableWaRoles(profile);
  if (roles.length <= 1) {
    await sendText(waPhone, `You're set up as a *${roles[0]}*. Reply *MENU* for your options.`, admin);
    return;
  }

  await sendList(
    waPhone,
    `${profile.firstName}, you have multiple roles on NyumbaSearch. Which mode should I use?`,
    "Switch role",
    [
      {
        title: "Your roles",
        rows: roles.map((r) => ({
          id: `switch_${r}`,
          title: ROLE_LABELS[r].replace(/^[^\s]+\s/, ""),
          description: ROLE_LABELS[r],
        })),
      },
    ],
    admin,
  );
  await updateState(admin, waPhone, session.state, { switchingRole: true });
}

export async function showPersonalHome(
  admin: Admin,
  waPhone: string,
  session: WaSession,
  profile: UserAssistantProfile,
  senderName: string,
  message: WaInboundMessage,
): Promise<void> {
  const digest = formatProfileDigest(profile);
  const roles = availableWaRoles(profile);

  if (roles.length > 1) {
    await sendList(
      waPhone,
      `${digest}\n\nI'm your personal NyumbaSearch assistant. What would you like to do?`,
      "Choose",
      [
        {
          title: "Your account",
          rows: [
            ...(roles.includes("tenant")
              ? [{ id: "role_tenant", title: "Find a home", description: "Search & unlock contacts" }]
              : []),
            ...(roles.includes("landlord") || roles.includes("agent")
              ? [{ id: "role_landlord", title: "My listings", description: "Add or manage properties" }]
              : []),
            ...(roles.includes("provider")
              ? [{ id: "role_provider", title: "My services", description: "Provider dashboard" }]
              : []),
            { id: "my_status", title: "Account summary", description: "Plan, unlocks, stats" },
            { id: "saved_homes", title: "Saved homes", description: `${profile.savedCount} saved` },
            { id: "my_viewings", title: "My viewings", description: "Upcoming appointments" },
            { id: "nyumbaai_start", title: "Ask NyumbaAI", description: "Personal property advice" },
            { id: "switch_role", title: "Switch role", description: "Change assistant mode" },
          ].slice(0, 10),
        },
      ],
      admin,
    );
    await updateState(admin, waPhone, "personal_home");
    return;
  }

  // Single role — go straight to personalized role menu
  session.role = roles[0] ?? "tenant";
  await updateState(admin, waPhone, `${session.role}_menu`);

  if (session.role === "tenant") {
    await handleTenantFlow(admin, waPhone, senderName, session, message, "tenant_menu", profile);
    return;
  }
  if (session.role === "landlord" || session.role === "agent") {
    await handleLandlordFlow(admin, waPhone, senderName, session, message, "landlord_menu", profile);
    return;
  }
  await handleProviderFlow(admin, waPhone, senderName, session, message, "provider_menu", profile);
}

async function routeToRoleMenu(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  message: WaInboundMessage,
  role: WaRole,
  profile: UserAssistantProfile,
): Promise<void> {
  if (role === "tenant") {
    await handleTenantFlow(admin, waPhone, senderName, session, message, "tenant_menu", profile);
    return;
  }
  if (role === "landlord" || role === "agent") {
    await handleLandlordFlow(admin, waPhone, senderName, session, message, "landlord_menu", profile);
    return;
  }
  await handleProviderFlow(admin, waPhone, senderName, session, message, "provider_menu", profile);
}

async function handleRoleSwitchInput(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  message: WaInboundMessage,
  input: string,
  profile: UserAssistantProfile,
): Promise<boolean> {
  if (!input.startsWith("switch_")) return false;

  const role = input.replace("switch_", "") as WaRole;
  if (!["tenant", "landlord", "agent", "provider"].includes(role)) return false;

  session.role = role;
  await updateState(admin, waPhone, `${role}_menu`);
  const name = displayFirstName(profile, senderName);
  await sendText(waPhone, `Switched to *${ROLE_LABELS[role]}* mode. Hi ${name}!`, admin);
  await routeToRoleMenu(admin, waPhone, senderName, session, message, role, profile);
  return true;
}

async function handlePersonalHomeInput(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  message: WaInboundMessage,
  input: string,
  profile: UserAssistantProfile,
): Promise<boolean> {
  if (session.state !== "personal_home") return false;

  if (input === "role_tenant") {
    session.role = "tenant";
    await updateState(admin, waPhone, "tenant_menu");
    await handleTenantFlow(admin, waPhone, senderName, session, message, "tenant_menu", profile);
    return true;
  }
  if (input === "role_landlord") {
    session.role = session.role === "agent" ? "agent" : "landlord";
    await updateState(admin, waPhone, "landlord_menu");
    await handleLandlordFlow(admin, waPhone, senderName, session, message, "landlord_menu", profile);
    return true;
  }
  if (input === "role_provider") {
    session.role = "provider";
    await updateState(admin, waPhone, "provider_menu");
    await handleProviderFlow(admin, waPhone, senderName, session, message, "provider_menu", profile);
    return true;
  }
  return false;
}

export async function handlePersonalAssistantCommand(
  admin: Admin,
  waPhone: string,
  session: WaSession,
  profile: UserAssistantProfile,
  senderName: string,
  message: WaInboundMessage,
  input: string,
): Promise<boolean> {
  if (input === "my_status" || input === "status") {
    await sendAccountStatus(admin, waPhone, profile);
    return true;
  }

  if (input === "saved_homes") {
    await sendSavedHomes(admin, waPhone, profile);
    return true;
  }

  if (input === "my_viewings") {
    await sendMyViewings(admin, waPhone, profile);
    return true;
  }

  if (input === "switch_role") {
    await sendRoleSwitcher(admin, waPhone, profile, session);
    return true;
  }

  if (await handleRoleSwitchInput(admin, waPhone, senderName, session, message, input, profile)) {
    return true;
  }

  if (await handlePersonalHomeInput(admin, waPhone, senderName, session, message, input, profile)) {
    return true;
  }

  return false;
}
