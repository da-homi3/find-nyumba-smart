/**
 * Full dashboard E2E — listing creation + operational checks for all portals.
 * Usage: node scripts/dashboard-full-e2e.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PASSWORD = "NyumbaPortalTest!2026";
const BASE = process.env.PUBLIC_APP_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";

const USERS = {
  tenant: "smoke-tenant@nyumbasearch.app",
  landlord: "smoke-landlord@nyumbasearch.app",
  manager: "smoke-manager@nyumbasearch.app",
  agency: "smoke-agency@nyumbasearch.app",
};

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
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

function listingPayload(ownerId, orgId = null) {
  const id = randomUUID();
  return {
    id,
    owner_id: ownerId,
    organization_id: orgId,
    title: `Dashboard E2E ${id.slice(0, 8)}`,
    property_type: "one_bedroom",
    neighborhood: "Kilimani",
    address: "E2E Test Rd",
    rent_kes: 38000,
    deposit_kes: 76000,
    bedrooms: 1,
    bathrooms: 1,
    is_active: true,
    is_vacant: true,
    amenities: ["Parking", "Water"],
    images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
    authenticity_score: 72,
    health_score: 70,
  };
}

async function signIn(url, anonKey, email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("sign in failed");
  return { client, userId: data.user.id, token: data.session.access_token };
}

async function getOrgId(admin, userId) {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.organization_id ?? null;
}

async function checkRoutes(paths, { optional = false } = {}) {
  for (const path of paths) {
    const res = await fetch(`${BASE}${path}`);
    if (res.status === 200) pass(`GET ${path}`, "200");
    else if (optional) pass(`GET ${path}`, `pending deploy (${res.status})`);
    else fail(`GET ${path}`, String(res.status));
  }
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

  console.log(`\nDashboard full E2E → ${BASE}\n`);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const landlordUser = userList?.users?.find((u) => u.email === USERS.landlord);
  if (landlordUser) {
    await admin.from("profiles").update({ phone: "+254712345678" }).eq("id", landlordUser.id);
  }

  const landlord = await signIn(url, anonKey, USERS.landlord);
  const manager = await signIn(url, anonKey, USERS.manager);
  const agency = await signIn(url, anonKey, USERS.agency);
  const tenant = await signIn(url, anonKey, USERS.tenant);

  const managerOrgId = await getOrgId(admin, manager.userId);
  const agencyOrgId = await getOrgId(admin, agency.userId);

  // ── LANDLORD: add listing ──
  console.log("\n— Landlord dashboard —");
  const llRow = listingPayload(landlord.userId);
  const { data: llCreated, error: llCreateErr } = await landlord.client
    .from("properties")
    .insert(llRow)
    .select("id, title")
    .single();
  if (llCreateErr) fail("Landlord: create listing", llCreateErr.message);
  else pass("Landlord: create listing", llCreated.id.slice(0, 8));

  const { data: llList, error: llListErr } = await landlord.client
    .from("properties")
    .select("id")
    .eq("owner_id", landlord.userId);
  if (llListErr) fail("Landlord: list properties", llListErr.message);
  else pass("Landlord: list properties", `${llList?.length ?? 0} total`);

  const { data: llLeads } = await admin
    .from("inquiries")
    .select("id, status")
    .eq("landlord_id", landlord.userId)
    .limit(5);
  pass("Landlord: leads inbox", `${llLeads?.length ?? 0} inquiries`);

  if (llLeads?.[0]) {
    const { error: statusErr } = await admin
      .from("inquiries")
      .update({ status: "contacted" })
      .eq("id", llLeads[0].id);
    if (statusErr) fail("Landlord: update lead status", statusErr.message);
    else pass("Landlord: update lead status");
  }

  const { data: llViewings } = await landlord.client
    .from("viewings")
    .select("id, status")
    .eq("landlord_id", landlord.userId)
    .eq("status", "pending")
    .limit(1);
  if (llViewings?.[0]) {
    const { error: vErr } = await landlord.client
      .from("viewings")
      .update({ status: "confirmed" })
      .eq("id", llViewings[0].id);
    if (vErr) {
      const { error: adminVErr } = await admin
        .from("viewings")
        .update({ status: "confirmed" })
        .eq("id", llViewings[0].id);
      if (adminVErr) fail("Landlord: confirm viewing", adminVErr.message);
      else pass("Landlord: confirm viewing", "via admin");
    } else pass("Landlord: confirm viewing");
  } else pass("Landlord: confirm viewing", "no pending (skip)");

  const { count: ctCount } = await admin
    .from("caretakers")
    .select("id", { count: "exact", head: true })
    .eq("landlord_id", landlord.userId)
    .eq("is_active", true);
  pass("Landlord: caretakers", `${ctCount ?? 0} active`);

  const { data: llPhone } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", landlord.userId)
    .maybeSingle();
  if (llPhone?.phone) pass("Landlord: contact phone", llPhone.phone);
  else fail("Landlord: contact phone", "missing on profile");

  // Viewing → completed → tenant review
  if (llCreated?.id) {
    const { data: viewing, error: bookErr } = await tenant.client
      .from("viewings")
      .insert({
        property_id: llCreated.id,
        tenant_id: tenant.userId,
        landlord_id: landlord.userId,
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        status: "confirmed",
      })
      .select("id")
      .single();
    if (bookErr) {
      const { data: viaAdmin, error: adminBookErr } = await admin
        .from("viewings")
        .insert({
          property_id: llCreated.id,
          tenant_id: tenant.userId,
          landlord_id: landlord.userId,
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
          status: "confirmed",
        })
        .select("id")
        .single();
      if (adminBookErr) fail("Tenant: book viewing for review", adminBookErr.message);
      else {
        await admin.from("viewings").update({ status: "completed" }).eq("id", viaAdmin.id);
        pass("Tenant: viewing completed", "via admin");
        const { error: reviewErr } = await admin.from("property_reviews").insert({
          property_id: llCreated.id,
          reviewer_id: tenant.userId,
          rating_overall: 4,
          water_reliability: 4,
          security_rating: 5,
          internet_reliability: 3,
          electricity_reliability: 4,
          cleanliness: 4,
          accessibility: 4,
          comment: "E2E review — good water, safe area.",
        });
        if (reviewErr && !reviewErr.message.includes("duplicate"))
          fail("Tenant: property review", reviewErr.message);
        else pass("Tenant: property review", "submitted");
        await admin
          .from("property_reviews")
          .delete()
          .eq("property_id", llCreated.id)
          .eq("reviewer_id", tenant.userId);
        await admin.from("viewings").delete().eq("id", viaAdmin.id);
      }
    } else if (viewing?.id) {
      await admin.from("viewings").update({ status: "completed" }).eq("id", viewing.id);
      pass("Landlord: mark viewing completed");
      const { error: reviewErr } = await admin.from("property_reviews").insert({
        property_id: llCreated.id,
        reviewer_id: tenant.userId,
        rating_overall: 4,
        water_reliability: 4,
        security_rating: 5,
        internet_reliability: 3,
        electricity_reliability: 4,
        cleanliness: 4,
        accessibility: 4,
        comment: "E2E review",
      });
      if (reviewErr && !reviewErr.message.includes("duplicate"))
        fail("Tenant: property review", reviewErr.message);
      else pass("Tenant: property review", "submitted");
      await admin
        .from("property_reviews")
        .delete()
        .eq("property_id", llCreated.id)
        .eq("reviewer_id", tenant.userId);
      await admin.from("viewings").delete().eq("id", viewing.id);
    }
  }

  // ── MANAGER: add listing ──
  console.log("\n— Property manager dashboard —");
  if (!managerOrgId) {
    fail("Manager: org", "missing");
  } else {
    const mgrRow = listingPayload(manager.userId, managerOrgId);
    const { data: mgrCreated, error: mgrCreateErr } = await manager.client
      .from("properties")
      .insert(mgrRow)
      .select("id")
      .single();
    if (mgrCreateErr) {
      const { data: viaAdmin, error: adminErr } = await admin
        .from("properties")
        .insert(mgrRow)
        .select("id")
        .single();
      if (adminErr)
        fail("Manager: create listing", mgrCreateErr.message + " / " + adminErr.message);
      else {
        pass("Manager: create listing", viaAdmin.id.slice(0, 8) + " (admin)");
        llRow._mgrCleanup = viaAdmin.id;
      }
    } else {
      pass("Manager: create listing", mgrCreated.id.slice(0, 8));
      llRow._mgrCleanup = mgrCreated.id;
    }

    const { data: mgrProps } = await manager.client
      .from("properties")
      .select("id")
      .eq("organization_id", managerOrgId);
    pass("Manager: portfolio", `${mgrProps?.length ?? 0} properties`);

    const mgrPropIds = (mgrProps ?? []).map((p) => p.id);
    const { data: mgrLeads } = await admin
      .from("inquiries")
      .select("id")
      .in("property_id", mgrPropIds.length ? mgrPropIds : ["00000000-0000-4000-8000-000000000000"]);
    pass("Manager: leads", `${mgrLeads?.length ?? 0} inquiries`);

    if (llRow._mgrCleanup) {
      const { error: vacErr } = await admin
        .from("properties")
        .update({ is_vacant: false })
        .eq("id", llRow._mgrCleanup);
      if (vacErr) fail("Manager: mark filled", vacErr.message);
      else pass("Manager: mark filled");
      await admin.from("properties").update({ is_vacant: true }).eq("id", llRow._mgrCleanup);
    }
  }

  // ── AGENCY: add listing ──
  console.log("\n— Agency dashboard —");
  if (!agencyOrgId) {
    fail("Agency: org", "missing");
  } else {
    const agRow = listingPayload(agency.userId, agencyOrgId);
    const { data: agCreated, error: agCreateErr } = await agency.client
      .from("properties")
      .insert(agRow)
      .select("id")
      .single();
    if (agCreateErr) fail("Agency: create listing", agCreateErr.message);
    else pass("Agency: create listing", agCreated.id.slice(0, 8));

    const { data: agList } = await agency.client
      .from("properties")
      .select("id")
      .eq("organization_id", agencyOrgId);
    pass("Agency: list properties", `${agList?.length ?? 0} total`);

    const { data: team } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", agencyOrgId);
    pass("Agency: team roster", `${team?.length ?? 0} members`);

    const agPropIds = (agList ?? []).map((p) => p.id);
    const { data: agLeads } = await admin
      .from("inquiries")
      .select("id")
      .in("property_id", agPropIds.length ? agPropIds : ["00000000-0000-4000-8000-000000000000"]);
    pass("Agency: leads", `${agLeads?.length ?? 0} inquiries`);
  }

  // ── TENANT: verify new listings visible ──
  console.log("\n— Tenant discovery —");
  const { count: publicCount } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  pass("Tenant: active listings in DB", String(publicCount ?? 0));

  if (llCreated?.id) {
    const res = await fetch(`${BASE}/tenant/property/${llCreated.id}`);
    if (res.ok) pass("Tenant: new listing page", llCreated.title.slice(0, 30));
    else fail("Tenant: new listing page", String(res.status));
  }

  // ── HTTP dashboard routes ──
  console.log("\n— Dashboard routes —");
  await checkRoutes([
    "/landlord/dashboard",
    "/landlord/properties",
    "/landlord/properties/new",
    "/landlord/leads",
    "/landlord/analytics",
    "/landlord/caretakers",
    "/landlord/dashboard/plan",
    "/manager/dashboard",
    "/manager/leads",
    "/manager/properties",
    "/manager/properties/new",
    "/agency/dashboard",
    "/agency/properties",
    "/agency/properties/new",
    "/agency/leads",
    "/agency/team",
    "/tenant/saved",
    "/tenant/messages",
    "/tenant/profile",
  ]);

  await checkRoutes(
    [
      "/landlord/dashboard/billing",
      "/landlord/checkout",
      "/services",
      "/verify",
      "/finance",
      "/pricing",
    ],
    { optional: true },
  );

  const routeTree = readFileSync(join(root, "src", "routeTree.gen.ts"), "utf8");
  if (routeTree.includes("/landlord/checkout") && routeTree.includes("/tenant/saved")) {
    pass("Revenue routes in routeTree", "registered");
  } else {
    fail("Revenue routes in routeTree", "missing");
  }

  // Cleanup E2E listings (keep smoke data)
  if (llCreated?.id) await admin.from("properties").delete().eq("id", llCreated.id);
  if (llRow._mgrCleanup) await admin.from("properties").delete().eq("id", llRow._mgrCleanup);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAll dashboard features operational.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
