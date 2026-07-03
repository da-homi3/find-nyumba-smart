import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";
import { PlusRequiredError } from "@/lib/payments/require-plus";
import {
  assertInquiryParticipant,
  authContext,
  createInquirySchema,
  getUserOrganizationId,
  inquiryIdSchema,
  mapInquiryWithDetails,
  notifyInquiryParticipant,
  sendInquiryMessageSchema,
  updateInquiryStatusSchema,
  type InquiryRecord,
} from "@/lib/api/nyumba/nyumba-shared";

export const createInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createInquirySchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");

    const plus = await getTenantPlusStatus(supabase, userId);
    if (plus.tenantPlan !== "plus") {
      throw new PlusRequiredError();
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id, title")
      .eq("id", data.propertyId)
      .eq("is_active", true)
      .maybeSingle();

    if (propertyError) throw propertyError;
    if (!property?.owner_id) throw new Error("Landlord contact is unavailable for this listing");

    const { data: existingInquiry, error: existingError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("tenant_id", userId)
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    let inquiry: InquiryRecord | null = existingInquiry;

    if (!inquiry) {
      const { data: insertedInquiry, error: insertError } = await supabase
        .from("inquiries")
        .insert({
          tenant_id: userId,
          landlord_id: property.owner_id,
          property_id: property.id,
          message: data.message,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      inquiry = insertedInquiry;
    }

    if (!inquiry) {
      throw new Error("Could not start this conversation");
    }

    const { error: messageError } = await supabase.from("inquiry_messages").insert({
      inquiry_id: inquiry.id,
      sender_id: userId,
      body: data.message,
    });
    if (messageError) throw messageError;

    await supabase
      .from("inquiries")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", inquiry.id);

    void notifyInquiryParticipant(
      { ...inquiry, properties: { title: property.title } },
      userId,
      data.message,
    );

    return inquiry;
  });

export const listTenantInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");

    const { data, error } = await supabase
      .from("inquiries")
      .select(
        "*, properties(id,title,neighborhood,rent_kes,images), profiles:landlord_id(id,full_name,phone,avatar_url), inquiry_messages(*)",
      )
      .eq("tenant_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapInquiryWithDetails);
  });

export const listLandlordLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const ownedRoles = new Set((roleRows ?? []).map((r) => r.role));
    const portfolioWide =
      (ownedRoles.has("manager") || ownedRoles.has("agency")) && !ownedRoles.has("landlord");

    let query = supabase
      .from("inquiries")
      .select(
        "*, properties(id,title,neighborhood,rent_kes,images,organization_id), profiles:tenant_id(id,full_name,phone,avatar_url), inquiry_messages(*)",
      )
      .order("updated_at", { ascending: false });

    if (portfolioWide) {
      const orgId = await getUserOrganizationId(supabase, userId);
      if (orgId) {
        const { data: orgProps, error: orgPropsError } = await supabase
          .from("properties")
          .select("id")
          .eq("organization_id", orgId);
        if (orgPropsError) throw orgPropsError;
        const propertyIds = (orgProps ?? []).map((p) => p.id);
        if (propertyIds.length === 0) return [];
        query = query.in("property_id", propertyIds);
      } else {
        query = query.eq("landlord_id", userId);
      }
    } else {
      query = query.eq("landlord_id", userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []).map(mapInquiryWithDetails);
  });

export const updateInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateInquiryStatusSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);
    await assertInquiryParticipant(supabase, userId, data.inquiryId);

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .update({ status: data.status })
      .eq("id", data.inquiryId)
      .select("*")
      .single();

    if (error) throw error;
    return inquiry;
  });

export const listInquiryMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inquiryIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await assertInquiryParticipant(supabase, userId, data.inquiryId);
    const { data: messages, error } = await supabase
      .from("inquiry_messages")
      .select("*")
      .eq("inquiry_id", data.inquiryId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return messages ?? [];
  });

export const markMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inquiryIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await assertInquiryParticipant(supabase, userId, data.inquiryId);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("inquiry_messages")
      .update({ read_at: now })
      .eq("inquiry_id", data.inquiryId)
      .neq("sender_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { readAt: now };
  });

export const getInquiryThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inquiryIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const inquiry = await assertInquiryParticipant(supabase, userId, data.inquiryId);
    const counterpartyId = inquiry.tenant_id === userId ? inquiry.landlord_id : inquiry.tenant_id;
    if (!counterpartyId) throw new Error("Conversation participant missing");
    const { data: counterparty } = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url")
      .eq("id", counterpartyId)
      .maybeSingle();

    let phone = counterparty?.phone?.trim() ?? null;
    if (!phone && inquiry.property_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("contact_phone")
        .eq("id", inquiry.property_id)
        .maybeSingle();
      phone = property?.contact_phone?.trim() ?? null;
    }

    return {
      inquiry,
      counterparty: {
        id: counterparty?.id ?? counterpartyId,
        full_name: counterparty?.full_name ?? "Contact",
        phone,
        avatar_url: counterparty?.avatar_url ?? null,
      },
    };
  });

export const sendInquiryMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sendInquiryMessageSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const inquiry = await assertInquiryParticipant(supabase, userId, data.inquiryId);

    if (inquiry.tenant_id === userId) {
      const plus = await getTenantPlusStatus(supabase, userId);
      if (plus.tenantPlan !== "plus") {
        throw new PlusRequiredError();
      }
    }

    const { data: message, error } = await supabase
      .from("inquiry_messages")
      .insert({ inquiry_id: data.inquiryId, sender_id: userId, body: data.body })
      .select("*")
      .single();
    if (error) throw error;

    await supabase
      .from("inquiries")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.inquiryId);

    void notifyInquiryParticipant(inquiry, userId, data.body);

    return message;
  });
