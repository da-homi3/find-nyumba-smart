/**
 * Multi-portal E2E: tenant, landlord, property manager, agency.
 * Usage: node scripts/e2e-all-portals.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PASSWORD = "NyumbaPortalTest!2026";

const USERS = {
  tenant: "smoke-tenant@nyumbasearch.app",
  landlord: "smoke-landlord@nyumbasearch.app",
  manager: "smoke-manager@nyumbasearch.app",
  agency: "smoke-agency@nyumbasearch.app",
};

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
  return env;
}

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function ensureUser(admin, email, meta = {}) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users?.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    user = data.user;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: PASSWORD });
  }
  await admin.from("profiles").upsert({
    id: user.id,
    full_name: meta.full_name ?? email.split("@")[0],
    phone: meta.phone ?? null,
    active_portal: meta.active_portal ?? "tenant",
    is_portal_active: true,
  });
  return user;
}

async function ensureRole(admin, userId, role) {
  const { data } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (!data) {
    const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
    if (error && !error.message.includes("duplicate")) throw error;
  }
}

async function signIn(url, anonKey, email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("no session");
  return client;
}

async function ensureOrg(admin, userId, name, type) {
  const { data: member } = await admin
    .from("organization_members")
    .select("organization_id, organizations(id, name, type)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (member?.organization_id) return member.organization_id;

  const slug = `${name.toLowerCase().replace(/\W+/g, "-").slice(0, 32)}-${userId.slice(0, 8)}`;
  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name, slug, type })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });
  return org.id;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  console.log("\nNyumbaSearch — all-portal E2E\n");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ── Setup users ──
  const tenant = await ensureUser(admin, USERS.tenant, {
    full_name: "Smoke Tenant",
    active_portal: "tenant",
  });
  await ensureRole(admin, tenant.id, "tenant");

  const landlord = await ensureUser(admin, USERS.landlord, {
    full_name: "Smoke Landlord",
    active_portal: "landlord",
    phone: "+254712345678",
  });
  await ensureRole(admin, landlord.id, "landlord");
  await ensureRole(admin, landlord.id, "tenant");

  const manager = await ensureUser(admin, USERS.manager, {
    full_name: "Smoke Manager",
    active_portal: "manager",
  });
  await ensureRole(admin, manager.id, "manager");
  await ensureRole(admin, manager.id, "tenant");
  const managerOrgId = await ensureOrg(admin, manager.id, "Smoke PM Ltd", "property_manager");

  const agencyUser = await ensureUser(admin, USERS.agency, {
    full_name: "Smoke Agency",
    active_portal: "agency",
  });
  await ensureRole(admin, agencyUser.id, "agency");
  await ensureRole(admin, agencyUser.id, "tenant");
  const agencyOrgId = await ensureOrg(admin, agencyUser.id, "Smoke Realty", "agency");

  pass("Test users ready", "tenant, landlord, manager, agency");

  // Fix orphan properties (null owner_id)
  const { data: orphans } = await admin
    .from("properties")
    .select("id")
    .eq("is_active", true)
    .is("owner_id", null);
  if (orphans?.length) {
    await admin.from("properties").update({ owner_id: landlord.id }).is("owner_id", null);
    pass("Fixed orphan properties", `${orphans.length} assigned to landlord`);
  }

  // Link sample properties to orgs for manager/agency visibility
  const { data: sampleProps } = await admin
    .from("properties")
    .select("id")
    .eq("owner_id", landlord.id)
    .eq("is_active", true)
    .limit(6);

  if (sampleProps?.length >= 2) {
    await admin
      .from("properties")
      .update({ organization_id: managerOrgId })
      .eq("id", sampleProps[0].id);
    await admin
      .from("properties")
      .update({ organization_id: agencyOrgId })
      .eq("id", sampleProps[1].id);
    pass("Linked properties to manager/agency orgs");
  }

  const managerPropId = sampleProps?.[0]?.id;
  const agencyPropId = sampleProps?.[1]?.id;

  // ── TENANT ──
  console.log("\n— Tenant —");
  const tenantClient = await signIn(url, anonKey, USERS.tenant);
  let liveProp = managerPropId
    ? (
        await admin
          .from("properties")
          .select("id, owner_id, title")
          .eq("id", managerPropId)
          .maybeSingle()
      ).data
    : null;

  if (!liveProp) {
    liveProp = (
      await admin
        .from("properties")
        .select("id, owner_id, title")
        .eq("owner_id", landlord.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
    ).data;
  }

  if (!liveProp) {
    fail("Tenant: live property", "none");
  } else {
    const { error: saveErr } = await tenantClient
      .from("saved_properties")
      .insert({ user_id: tenant.id, property_id: liveProp.id });
    if (saveErr?.message?.includes("duplicate")) pass("Tenant: save listing", "already saved");
    else if (saveErr) fail("Tenant: save listing", saveErr.message);
    else pass("Tenant: save listing");

    const { data: existing } = await tenantClient
      .from("inquiries")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("property_id", liveProp.id)
      .maybeSingle();

    if (existing) {
      pass("Tenant: message landlord", existing.id.slice(0, 8));
    } else {
      const { data: inq, error: inqErr } = await tenantClient
        .from("inquiries")
        .insert({
          tenant_id: tenant.id,
          landlord_id: liveProp.owner_id,
          property_id: liveProp.id,
          message: `Portal E2E ${Date.now()}`,
        })
        .select("id")
        .single();
      if (inqErr) fail("Tenant: message landlord", inqErr.message);
      else pass("Tenant: message landlord", inq.id.slice(0, 8));
    }

    const scheduledAt = new Date(Date.now() + 4 * 86400000);
    scheduledAt.setHours(14, 0, 0, 0);
    const { error: bookErr } = await tenantClient.from("viewings").insert({
      property_id: liveProp.id,
      tenant_id: tenant.id,
      landlord_id: liveProp.owner_id,
      scheduled_at: scheduledAt.toISOString(),
      status: "pending",
      notes: "Portal E2E booking",
    });
    if (bookErr && bookErr.message.includes("duplicate"))
      pass("Tenant: book viewing", "already booked");
    else if (bookErr) fail("Tenant: book viewing", bookErr.message);
    else pass("Tenant: book viewing");
  }

  // ── LANDLORD ──
  console.log("\n— Landlord —");
  const landlordClient = await signIn(url, anonKey, USERS.landlord);
  const { data: llProps, error: llPropsErr } = await landlordClient
    .from("properties")
    .select("id, title")
    .eq("owner_id", landlord.id);
  if (llPropsErr) fail("Landlord: list properties", llPropsErr.message);
  else pass("Landlord: list properties", `${llProps?.length ?? 0} listings`);

  const { data: llLeads, error: llLeadsErr } = await landlordClient
    .from("inquiries")
    .select("id")
    .eq("landlord_id", landlord.id);
  if (llLeadsErr) fail("Landlord: list leads", llLeadsErr.message);
  else pass("Landlord: list leads", `${llLeads?.length ?? 0} inquiries`);

  const { data: newProp, error: createErr } = await landlordClient
    .from("properties")
    .insert({
      id: randomUUID(),
      owner_id: landlord.id,
      title: `E2E Listing ${Date.now()}`,
      property_type: "one_bedroom",
      neighborhood: "Kilimani",
      address: "Test Rd",
      rent_kes: 35000,
      deposit_kes: 70000,
      bedrooms: 1,
      bathrooms: 1,
      is_active: true,
      is_vacant: true,
      amenities: ["Parking"],
      images: [],
      authenticity_score: 70,
      health_score: 70,
    })
    .select("id")
    .single();
  if (createErr) fail("Landlord: create property", createErr.message);
  else {
    pass("Landlord: create property", newProp.id.slice(0, 8));
    await admin.from("properties").delete().eq("id", newProp.id);
  }

  const { data: viewings, error: viewErr } = await landlordClient
    .from("viewings")
    .select("id, status")
    .eq("landlord_id", landlord.id)
    .limit(5);
  if (viewErr) fail("Landlord: viewings", viewErr.message);
  else pass("Landlord: viewings", `${viewings?.length ?? 0} bookings`);

  // ── MANAGER ──
  console.log("\n— Property manager —");
  const managerClient = await signIn(url, anonKey, USERS.manager);
  const { data: mgrProps, error: mgrPropsErr } = await managerClient
    .from("properties")
    .select("id, title")
    .eq("organization_id", managerOrgId);
  if (mgrPropsErr) fail("Manager: portfolio", mgrPropsErr.message);
  else pass("Manager: portfolio", `${mgrProps?.length ?? 0} properties`);

  const mgrPropIds = (mgrProps ?? []).map((p) => p.id);
  if (mgrPropIds.length) {
    const { data: mgrLeads, error: mgrLeadsErr } = await admin
      .from("inquiries")
      .select("id")
      .in("property_id", mgrPropIds);
    if (mgrLeadsErr) fail("Manager: leads", mgrLeadsErr.message);
    else if ((mgrLeads?.length ?? 0) === 0)
      fail("Manager: leads", "expected inquiry on org property");
    else pass("Manager: leads", `${mgrLeads?.length ?? 0} inquiries (org portfolio)`);
  } else {
    fail("Manager: leads", "no org properties to query");
  }

  // ── AGENCY ──
  console.log("\n— Real estate agency —");
  const agencyClient = await signIn(url, anonKey, USERS.agency);
  const { data: agProps, error: agPropsErr } = await agencyClient
    .from("properties")
    .select("id, title")
    .eq("organization_id", agencyOrgId);
  if (agPropsErr) fail("Agency: portfolio", agPropsErr.message);
  else pass("Agency: portfolio", `${agProps?.length ?? 0} properties`);

  const { data: team, error: teamErr } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", agencyOrgId);
  if (teamErr) fail("Agency: team", teamErr.message);
  else pass("Agency: team", `${team?.length ?? 0} members`);

  const { data: agNew, error: agCreateErr } = await agencyClient
    .from("properties")
    .insert({
      id: randomUUID(),
      owner_id: agencyUser.id,
      organization_id: agencyOrgId,
      title: `Agency E2E ${Date.now()}`,
      property_type: "two_bedroom",
      neighborhood: "Westlands",
      address: "Ring Rd",
      rent_kes: 55000,
      deposit_kes: 110000,
      bedrooms: 2,
      bathrooms: 2,
      is_active: true,
      is_vacant: true,
      amenities: ["Gym"],
      images: [],
      authenticity_score: 75,
      health_score: 75,
    })
    .select("id")
    .single();
  if (agCreateErr) fail("Agency: create property", agCreateErr.message);
  else {
    pass("Agency: create property", agNew.id.slice(0, 8));
    await admin.from("properties").delete().eq("id", agNew.id);
  }

  const agPropIds = (agProps ?? []).map((p) => p.id);
  if (agPropIds.length) {
    const { data: agLeads, error: agLeadsErr } = await agencyClient
      .from("inquiries")
      .select("id")
      .in("property_id", agPropIds);
    if (agLeadsErr) fail("Agency: leads", agLeadsErr.message);
    else pass("Agency: leads", `${agLeads?.length ?? 0} inquiries`);
  }

  // Agency-specific inquiry on agency portfolio property
  if (agencyPropId && agencyPropId !== liveProp?.id) {
    const { data: agProp } = await admin
      .from("properties")
      .select("id, owner_id")
      .eq("id", agencyPropId)
      .maybeSingle();
    if (agProp?.owner_id) {
      const { data: existingAgInq } = await tenantClient
        .from("inquiries")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("property_id", agProp.id)
        .maybeSingle();
      if (!existingAgInq) {
        await tenantClient.from("inquiries").insert({
          tenant_id: tenant.id,
          landlord_id: agProp.owner_id,
          property_id: agProp.id,
          message: `Agency E2E ${Date.now()}`,
        });
      }
    }
  }

  // ── HTTP routes smoke ──
  console.log("\n— HTTP routes —");
  const BASE = env.PUBLIC_APP_URL ?? "https://nyumbasearch.com";
  for (const path of [
    "/tenant",
    "/landlord/dashboard",
    "/manager/dashboard",
    "/manager/leads",
    "/agency/dashboard",
    "/agency/leads",
    "/agency/properties",
    "/landlord/properties",
  ]) {
    const res = await fetch(`${BASE}${path}`);
    if (res.status === 200) pass(`GET ${path}`, "200");
    else fail(`GET ${path}`, String(res.status));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }

  console.log("\nAll portal tests passed.\n");
  console.log("Test logins (password for all):", PASSWORD);
  for (const [role, email] of Object.entries(USERS)) {
    console.log(`  ${role}: ${email}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
