import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { enhanceListingDescription } from "@/lib/flows/nyumbaai";
import { sendAccountStatus } from "@/lib/flows/assistant";
import {
  handleAccountLinkEmail,
  handleAccountLinkOtp,
  promptAccountLink,
  tryResolveSessionUser,
} from "@/lib/flows/link-account";
import { sendButtons, sendList, sendText } from "@/lib/whatsapp/client";
import { reverseGeocodeNairobi } from "@/lib/whatsapp/geocode";
import { uploadWhatsAppPhoto } from "@/lib/whatsapp/media";
import { getSiteUrl } from "@/lib/site";
import { updateState } from "@/lib/whatsapp/session";
import type { WaInboundMessage, WaSession } from "@/lib/whatsapp/types";
import {
  displayFirstName,
  formatProfileDigest,
  refreshSessionProfile,
  type UserAssistantProfile,
} from "@/lib/whatsapp/user-profile";

type Admin = SupabaseClient<Database>;
type PropertyType = Database["public"]["Enums"]["property_type"];
type ListingDraft = Record<string, unknown>;

const TYPE_MAP: Record<string, { type: PropertyType; bedrooms: number }> = {
  type_bedsitter: { type: "bedsitter", bedrooms: 0 },
  type_1br: { type: "one_bedroom", bedrooms: 1 },
  type_2br: { type: "two_bedroom", bedrooms: 2 },
  type_3br: { type: "three_bedroom", bedrooms: 3 },
  type_4brplus: { type: "three_bedroom", bedrooms: 4 },
  type_maisonette: { type: "maisonette", bedrooms: 3 },
  type_bungalow: { type: "bungalow", bedrooms: 3 },
  type_commercial: { type: "studio", bedrooms: 0 },
};

function formatPhone254(input: string, waPhone: string): string {
  let phone = input === "use_wa_number" ? waPhone : input.replace(/\s/g, "");
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`;
  if (!phone.startsWith("254")) phone = `254${phone}`;
  return phone;
}

function draftString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function showLandlordMenu(
  admin: Admin,
  waPhone: string,
  firstName: string,
  profile: UserAssistantProfile | null | undefined,
): Promise<void> {
  if (profile) {
    const intro = formatProfileDigest(profile);
    const listingHint =
      profile.activeListings > 0 || profile.pendingListings > 0
        ? `\n📋 ${profile.activeListings} live · ${profile.pendingListings} pending · ${profile.totalLeads} leads`
        : "\n_No listings yet — add your first property!_";

    await sendList(
      waPhone,
      `${intro}${listingHint}\n\nYour landlord assistant:`,
      "Menu",
      [
        {
          title: "Landlord",
          rows: [
            { id: "listing_new", title: "Add listing", description: "Create new property" },
            {
              id: "my_listings",
              title: "My listings",
              description: `${profile.activeListings + profile.pendingListings} total`,
            },
            { id: "my_leads", title: "View leads", description: `${profile.totalLeads} unlocks` },
            { id: "my_status", title: "Account", description: "Plan & stats" },
            { id: "switch_role", title: "Switch role", description: "Tenant or provider mode" },
          ],
        },
      ],
      admin,
    );
  } else {
    await sendButtons(
      waPhone,
      `👋 ${firstName}, what would you like to do?`,
      [
        { id: "listing_new", label: "➕ Add listing" },
        { id: "my_listings", label: "📋 My listings" },
        { id: "my_leads", label: "📥 View leads" },
      ],
      admin,
    );
  }
  await updateState(admin, waPhone, "landlord_menu");
}

async function handleListingTitleStep(
  admin: Admin,
  waPhone: string,
  input: string,
  draft: ListingDraft,
): Promise<void> {
  if (input.length < 10) {
    await sendText(waPhone, "Please use a longer title (10+ characters).", admin);
    return;
  }
  await updateState(admin, waPhone, "listing_price", { draft: { ...draft, title: input } });
  await sendText(
    waPhone,
    `✅ Title saved.\n\nStep 2/8 — *Monthly rent (KES)?* Numbers only.`,
    admin,
  );
}

async function handleListingPriceStep(
  admin: Admin,
  waPhone: string,
  input: string,
  draft: ListingDraft,
): Promise<void> {
  const price = Number.parseInt(input.replace(/\D/g, ""), 10);
  if (!price || price < 1000 || price > 1_000_000) {
    await sendText(waPhone, "Enter rent between KES 1,000 and 1,000,000.", admin);
    return;
  }
  await updateState(admin, waPhone, "listing_type", { draft: { ...draft, price } });
  await sendList(
    waPhone,
    "Step 3/8 — Property type?",
    "Type",
    [
      {
        title: "Types",
        rows: [
          { id: "type_bedsitter", title: "Bedsitter" },
          { id: "type_1br", title: "1 Bedroom" },
          { id: "type_2br", title: "2 Bedroom" },
          { id: "type_3br", title: "3 Bedroom" },
          { id: "type_maisonette", title: "Maisonette" },
          { id: "type_bungalow", title: "Bungalow" },
        ],
      },
    ],
    admin,
  );
}

async function handleListingTypeStep(
  admin: Admin,
  waPhone: string,
  input: string,
  draft: ListingDraft,
): Promise<void> {
  const mapped = TYPE_MAP[input];
  if (!mapped) {
    await sendText(waPhone, "Choose a type from the list.", admin);
    return;
  }
  await updateState(admin, waPhone, "listing_location", {
    draft: { ...draft, property_type: mapped.type, bedrooms: mapped.bedrooms },
  });
  await sendText(waPhone, "Step 4/8 — *Neighbourhood* or send 📍 location pin.", admin);
}

async function handleListingLocationStep(
  admin: Admin,
  waPhone: string,
  input: string,
  message: WaInboundMessage,
  draft: ListingDraft,
): Promise<void> {
  let neighborhood = "";
  let lat: number | null = null;
  let lng: number | null = null;

  if (message.type === "location" && message.location) {
    lat = message.location.latitude;
    lng = message.location.longitude;
    neighborhood = reverseGeocodeNairobi(lat, lng) ?? "Nairobi";
  } else {
    neighborhood = input;
  }

  if (neighborhood.length < 3) {
    await sendText(waPhone, "Enter neighbourhood name or share location.", admin);
    return;
  }

  await updateState(admin, waPhone, "listing_description", {
    draft: { ...draft, neighborhood, lat, lng },
  });
  await sendText(
    waPhone,
    "Step 5/8 — *Description* (30+ chars). Water, security, parking...",
    admin,
  );
}

async function handleListingDescriptionStep(
  admin: Admin,
  waPhone: string,
  input: string,
  draft: ListingDraft,
): Promise<void> {
  if (input.length < 30) {
    await sendText(waPhone, "Please write a longer description.", admin);
    return;
  }
  const cleaned = await enhanceListingDescription(input, {
    ...draft,
    price: draft.price,
    neighborhood: draft.neighborhood,
  });
  await updateState(admin, waPhone, "listing_photos", {
    draft: { ...draft, description: cleaned },
  });
  await sendText(
    waPhone,
    "Step 6/8 — Send photos 📸 (up to 10). Type *DONE* when finished.",
    admin,
  );
}

async function handleListingPhotosStep(
  admin: Admin,
  waPhone: string,
  input: string,
  message: WaInboundMessage,
  session: WaSession,
): Promise<void> {
  const currentDraft = (session.context.draft as ListingDraft) ?? {};

  if (message.type === "image" && message.imageId) {
    try {
      const ownerKey = session.userId ?? waPhone;
      const url = await uploadWhatsAppPhoto(admin, message.imageId, ownerKey);
      const photos = [...((currentDraft.photos as string[]) ?? []), url];
      await updateState(admin, waPhone, "listing_photos", {
        draft: { ...currentDraft, photos },
      });
      await sendText(
        waPhone,
        `✅ Photo ${photos.length} saved. ${photos.length < 10 ? "Send more or *DONE*." : "Max reached — *DONE*."}`,
        admin,
      );
    } catch {
      await sendText(waPhone, "Could not save photo. Try again.", admin);
    }
    return;
  }

  if (input.toLowerCase() === "done" || input.toLowerCase() === "submit") {
    const photos = (currentDraft.photos as string[]) ?? [];
    if (photos.length < 1) {
      await sendText(waPhone, "Send at least 1 photo first.", admin);
      return;
    }
    await updateState(admin, waPhone, "listing_contact", { draft: { ...currentDraft, photos } });
    await sendButtons(
      waPhone,
      "Step 7/8 — Tenant contact number?",
      [{ id: "use_wa_number", label: "Use my WhatsApp" }],
      admin,
    );
    return;
  }

  await sendText(waPhone, "Send a photo or type *DONE*.", admin);
}

async function handleListingContactStep(
  admin: Admin,
  waPhone: string,
  input: string,
  draft: ListingDraft,
): Promise<void> {
  const contactPhone = formatPhone254(input, waPhone);
  if (!/^254\d{9}$/.test(contactPhone)) {
    await sendText(waPhone, "Enter a valid Kenyan phone number.", admin);
    return;
  }
  const nextDraft: ListingDraft = { ...draft, contact_phone: contactPhone };
  await updateState(admin, waPhone, "listing_review", { draft: nextDraft });
  const title = draftString(draft.title, "Listing");
  const neighborhood = draftString(draft.neighborhood);
  const photoCount = ((draft.photos as string[]) ?? []).length;
  await sendButtons(
    waPhone,
    `Review:\n🏠 *${title}*\n📍 ${neighborhood}\n💰 KES ${Number(draft.price).toLocaleString()}/mo\n📸 ${photoCount} photos`,
    [
      { id: "listing_submit", label: "✅ Submit" },
      { id: "listing_new", label: "✏️ Start over" },
    ],
    admin,
  );
}

async function submitListingDraft(
  admin: Admin,
  waPhone: string,
  session: WaSession,
): Promise<void> {
  const d = (session.context.draft as ListingDraft) ?? {};
  const userId = await tryResolveSessionUser(admin, session);
  const propertyId = crypto.randomUUID();
  const title = draftString(d.title, "Untitled listing");

  try {
    await admin.from("properties").insert({
      id: propertyId,
      title,
      rent_kes: Number(d.price),
      property_type: d.property_type as PropertyType,
      bedrooms: Number(d.bedrooms ?? 1),
      bathrooms: 1,
      neighborhood: draftString(d.neighborhood, "Nairobi"),
      latitude: d.lat as number | null,
      longitude: d.lng as number | null,
      description: draftString(d.description),
      contact_phone: draftString(d.contact_phone, waPhone),
      images: (d.photos as string[]) ?? [],
      is_active: false,
      is_vacant: true,
      owner_id: userId,
    });

    await sendText(
      waPhone,
      `🎉 *Listing submitted!*\n\n*${title}* is pending review. We'll notify you when it's live.\n\n${getSiteUrl()}/landlord/properties`,
      admin,
    );
    await updateState(admin, waPhone, "landlord_menu", { draft: {} });
    const refreshed = await refreshSessionProfile(admin, session);
    if (refreshed) {
      await sendText(
        waPhone,
        `📋 Updated: you now have ${refreshed.activeListings} live and ${refreshed.pendingListings} pending listing${refreshed.pendingListings === 1 ? "" : "s"}.\n\nReply *MENU* for your personalised dashboard.`,
        admin,
      );
    }
  } catch (err) {
    console.error("WhatsApp listing save error:", err);
    await sendText(waPhone, "❌ Could not save listing. Try nyumbasearch.com/dashboard", admin);
  }
}

async function showMyListings(admin: Admin, waPhone: string, userId: string): Promise<void> {
  const { data: listings } = await admin
    .from("properties")
    .select("title, is_active, views")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!listings?.length) {
    await sendButtons(
      waPhone,
      "No listings yet.",
      [{ id: "listing_new", label: "➕ Add first" }],
      admin,
    );
    return;
  }

  const summary = listings
    .map((l, i) => `${i + 1}. ${l.is_active ? "✅" : "⏳"} *${l.title}* — ${l.views} views`)
    .join("\n");
  await sendText(
    waPhone,
    `📋 *Listings:*\n\n${summary}\n\n${getSiteUrl()}/landlord/properties`,
    admin,
  );
}

async function showMyLeads(admin: Admin, waPhone: string, userId: string): Promise<void> {
  const { data: props } = await admin.from("properties").select("id, title").eq("owner_id", userId);
  const ids = (props ?? []).map((p) => p.id);
  if (!ids.length) {
    await sendText(waPhone, "No leads yet — list a property first.", admin);
    return;
  }
  const { count } = await admin
    .from("contact_unlocks")
    .select("id", { count: "exact", head: true })
    .in("listing_id", ids);
  await sendText(waPhone, `📥 *Leads:* ${count ?? 0} contact unlock(s) on your listings.`, admin);
}

async function handleListingsOrLeads(
  admin: Admin,
  waPhone: string,
  session: WaSession,
  input: string,
): Promise<void> {
  const userId = await tryResolveSessionUser(admin, session);
  if (!userId) {
    await promptAccountLink(admin, waPhone);
    return;
  }

  if (input === "my_listings") {
    await showMyListings(admin, waPhone, userId);
    return;
  }

  await showMyLeads(admin, waPhone, userId);
}

type LandlordFlowContext = {
  admin: Admin;
  waPhone: string;
  senderName: string;
  session: WaSession;
  message: WaInboundMessage;
  input: string;
  profile?: UserAssistantProfile | null;
  firstName: string;
  draft: ListingDraft;
};

async function dispatchListingWizardStep(ctx: LandlordFlowContext): Promise<boolean> {
  const { admin, waPhone, input, message, session, draft } = ctx;
  const stepHandlers: Partial<Record<WaSession["state"], () => Promise<void>>> = {
    listing_title: () => handleListingTitleStep(admin, waPhone, input, draft),
    listing_price: () => handleListingPriceStep(admin, waPhone, input, draft),
    listing_type: () => handleListingTypeStep(admin, waPhone, input, draft),
    listing_location: () => handleListingLocationStep(admin, waPhone, input, message, draft),
    listing_description: () => handleListingDescriptionStep(admin, waPhone, input, draft),
    listing_photos: () => handleListingPhotosStep(admin, waPhone, input, message, session),
    listing_contact: () => handleListingContactStep(admin, waPhone, input, draft),
  };

  const handler = stepHandlers[session.state];
  if (!handler) return false;
  await handler();
  return true;
}

async function handleAccountLinkSteps(
  admin: Admin,
  waPhone: string,
  input: string,
  session: WaSession,
): Promise<boolean> {
  if (session.state === "account_link_email") {
    if (!input.includes("@")) {
      await sendText(waPhone, "Enter your registered email:", admin);
      return true;
    }
    await handleAccountLinkEmail(admin, waPhone, input);
    if (session.role === "landlord" || session.role === "agent") {
      session.role = "landlord";
      await updateState(admin, waPhone, "landlord_menu");
    }
    return true;
  }

  if (session.state === "account_link_otp") {
    await handleAccountLinkOtp(admin, waPhone, input, session);
    return true;
  }

  return false;
}

export async function handleLandlordFlow(
  admin: Admin,
  waPhone: string,
  senderName: string,
  session: WaSession,
  message: WaInboundMessage,
  input: string,
  profile?: UserAssistantProfile | null,
): Promise<void> {
  const firstName = displayFirstName(profile ?? null, senderName);
  const draft = (session.context.draft as ListingDraft) ?? {};
  const ctx: LandlordFlowContext = {
    admin,
    waPhone,
    senderName,
    session,
    message,
    input,
    profile,
    firstName,
    draft,
  };

  if (input === "my_status" && profile) {
    await sendAccountStatus(admin, waPhone, profile);
    return;
  }

  if (session.state === "landlord_menu" || input === "landlord_menu") {
    await showLandlordMenu(admin, waPhone, firstName, profile);
    return;
  }

  if (input === "listing_new") {
    await updateState(admin, waPhone, "listing_title", { draft: {} });
    await sendText(
      waPhone,
      "Step 1/8 — *Property title?*\n\nExample: _2BR apartment in Kilimani_",
      admin,
    );
    return;
  }

  if (await dispatchListingWizardStep(ctx)) return;

  if (input === "listing_submit" && session.state === "listing_review") {
    await submitListingDraft(admin, waPhone, session);
    return;
  }

  if (input === "my_listings" || input === "my_leads") {
    await handleListingsOrLeads(admin, waPhone, session, input);
    return;
  }

  if (await handleAccountLinkSteps(admin, waPhone, input, session)) return;

  await sendButtons(
    waPhone,
    "Landlord menu:",
    [
      { id: "listing_new", label: "➕ Add listing" },
      { id: "my_listings", label: "📋 Listings" },
      { id: "landlord_menu", label: "🏠 Menu" },
    ],
    admin,
  );
}
