/**
 * Authenticated feature tests (save, message, book) via Supabase as a signed-in tenant.
 * Mirrors server-fn data paths with the same user JWT the app sends.
 * Usage: node scripts/e2e-auth-test.mjs
 * Env: NYUMBA_SMOKE_TEST_PASSWORD in .env (shared smoke test accounts)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const TEST_EMAIL = "smoke-tenant@nyumbasearch.app";

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

function getTestPassword(env) {
  const password = process.env.NYUMBA_SMOKE_TEST_PASSWORD ?? env.NYUMBA_SMOKE_TEST_PASSWORD;
  if (!password) {
    throw new Error("Set NYUMBA_SMOKE_TEST_PASSWORD in .env (see .env.example)");
  }
  return password;
}

const results = [];

function formatLine(symbol, name, detail) {
  if (detail) return `${symbol} ${name} — ${detail}`;
  return `${symbol} ${name}`;
}

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(formatLine("✓", name, detail));
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(formatLine("✗", name, detail));
}

async function ensureTenantUser(admin, password) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users?.find((u) => u.email === TEST_EMAIL);

  if (user) {
    pass("Reuse test tenant", TEST_EMAIL);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    pass("Create test tenant", TEST_EMAIL);
  }

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "tenant")
    .maybeSingle();

  if (!roleRow) {
    const { error } = await admin.from("user_roles").insert({ user_id: user.id, role: "tenant" });
    if (error) throw error;
    pass("Assign tenant role");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    await admin.from("profiles").insert({
      id: user.id,
      full_name: "Smoke Test Tenant",
      active_portal: "tenant",
    });
  }

  return user;
}

async function signInTenant(client, password) {
  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password,
  });
  if (signInErr || !signIn.session) {
    fail("Sign in", signInErr?.message ?? "no session");
    process.exit(1);
  }
  return signIn;
}

async function loadLiveProperty(admin) {
  const { data: property, error: propErr } = await admin
    .from("properties")
    .select("id, owner_id, title")
    .eq("is_active", true)
    .not("owner_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (propErr || !property) {
    fail("Load live property", propErr?.message ?? "none");
    process.exit(1);
  }
  pass("Live property", property.title.slice(0, 40));
  return property;
}

async function testSaveListing(admin, client, user, property) {
  await admin
    .from("saved_properties")
    .delete()
    .eq("user_id", user.id)
    .eq("property_id", property.id);

  const { error: saveErr } = await client
    .from("saved_properties")
    .insert({ user_id: user.id, property_id: property.id });
  if (saveErr) {
    fail("Save listing", saveErr.message);
    return;
  }

  const { data: saved } = await client
    .from("saved_properties")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", property.id)
    .maybeSingle();
  if (saved) pass("Save listing", "inserted");
  else fail("Save listing", "not found after insert");
}

async function testMessageLandlord(client, user, property) {
  const msg = `Smoke test message ${Date.now()}`;
  const { data: existingInq } = await client
    .from("inquiries")
    .select("id")
    .eq("tenant_id", user.id)
    .eq("property_id", property.id)
    .maybeSingle();

  if (existingInq) {
    const { error: msgErr } = await client.from("inquiry_messages").insert({
      inquiry_id: existingInq.id,
      sender_id: user.id,
      body: msg,
    });
    if (msgErr) fail("Message landlord", msgErr.message);
    else pass("Message landlord", `thread ${existingInq.id.slice(0, 8)}`);
    return;
  }

  const { data: inq, error: inqErr } = await client
    .from("inquiries")
    .insert({
      tenant_id: user.id,
      landlord_id: property.owner_id,
      property_id: property.id,
      message: msg,
    })
    .select("id")
    .single();
  if (inqErr) {
    fail("Message landlord", inqErr.message);
    return;
  }

  const { error: msgErr } = await client.from("inquiry_messages").insert({
    inquiry_id: inq.id,
    sender_id: user.id,
    body: msg,
  });
  if (msgErr) fail("Message landlord", msgErr.message);
  else pass("Message landlord", `new thread ${inq.id.slice(0, 8)}`);
}

async function testBookViewing(client, user, property) {
  const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  scheduledAt.setHours(10, 0, 0, 0);
  const { data: viewing, error: bookErr } = await client
    .from("viewings")
    .insert({
      property_id: property.id,
      tenant_id: user.id,
      landlord_id: property.owner_id,
      scheduled_at: scheduledAt.toISOString(),
      status: "pending",
      notes: "Smoke test booking",
    })
    .select("id, status")
    .single();

  if (bookErr) fail("Book viewing", bookErr.message);
  else pass("Book viewing", viewing.status);
}

async function testDemoListingBlocked(client, user) {
  const demoId = "a1000001-0001-4000-8000-000000000001";
  const { error: demoSaveErr } = await client
    .from("saved_properties")
    .insert({ user_id: user.id, property_id: demoId });
  if (demoSaveErr) pass("Demo listing blocked", "RLS or FK rejected demo save");
  else fail("Demo listing blocked", "demo save should not succeed");
}

function printSummary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAuthenticated flows OK.\n");
  console.log(`Test login: ${TEST_EMAIL} (password from NYUMBA_SMOKE_TEST_PASSWORD)`);
}

async function main() {
  const env = loadEnv();
  const password = getTestPassword(env);
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error("Missing SUPABASE_URL, publishable key, or service role key in .env");
    process.exit(1);
  }

  console.log("\nNyumbaSearch authenticated E2E\n");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const user = await ensureTenantUser(admin, password);

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  await signInTenant(client, password);
  pass("Sign in", user.id.slice(0, 8));

  const property = await loadLiveProperty(admin);
  await testSaveListing(admin, client, user, property);
  await testMessageLandlord(client, user, property);
  await testBookViewing(client, user, property);
  await testDemoListingBlocked(client, user);

  printSummary();
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
