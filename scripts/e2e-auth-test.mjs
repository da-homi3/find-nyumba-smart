/**
 * Authenticated feature tests (save, message, book) via Supabase as a signed-in tenant.
 * Mirrors server-fn data paths with the same user JWT the app sends.
 * Usage: node scripts/e2e-auth-test.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const TEST_EMAIL = "smoke-tenant@nyumbasearch.app";
const TEST_PASSWORD = "NyumbaSmokeTest!2026";

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

async function ensureTenantUser(admin) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users?.find((u) => u.email === TEST_EMAIL);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    pass("Create test tenant", TEST_EMAIL);
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD });
    pass("Reuse test tenant", TEST_EMAIL);
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

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error("Missing SUPABASE_URL, publishable key, or service role key in .env");
    process.exit(1);
  }

  console.log("\nNyumbaSearch authenticated E2E\n");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const user = await ensureTenantUser(admin);

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErr || !signIn.session) {
    fail("Sign in", signInErr?.message ?? "no session");
    process.exit(1);
  }
  pass("Sign in", user.id.slice(0, 8));

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

  // ── Save listing ──
  await admin
    .from("saved_properties")
    .delete()
    .eq("user_id", user.id)
    .eq("property_id", property.id);

  const { error: saveErr } = await client
    .from("saved_properties")
    .insert({ user_id: user.id, property_id: property.id });
  if (saveErr) fail("Save listing", saveErr.message);
  else {
    const { data: saved } = await client
      .from("saved_properties")
      .select("id")
      .eq("user_id", user.id)
      .eq("property_id", property.id)
      .maybeSingle();
    if (saved) pass("Save listing", "inserted");
    else fail("Save listing", "not found after insert");
  }

  // ── Message landlord ──
  const msg = `Smoke test message ${Date.now()}`;
  let inquiryId = null;
  const { data: existingInq } = await client
    .from("inquiries")
    .select("id")
    .eq("tenant_id", user.id)
    .eq("property_id", property.id)
    .maybeSingle();

  if (existingInq) {
    inquiryId = existingInq.id;
    const { error: msgErr } = await client.from("inquiry_messages").insert({
      inquiry_id: inquiryId,
      sender_id: user.id,
      body: msg,
    });
    if (msgErr) fail("Message landlord", msgErr.message);
    else pass("Message landlord", `thread ${inquiryId.slice(0, 8)}`);
  } else {
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
    if (inqErr) fail("Message landlord", inqErr.message);
    else {
      inquiryId = inq.id;
      const { error: msgErr } = await client.from("inquiry_messages").insert({
        inquiry_id: inquiryId,
        sender_id: user.id,
        body: msg,
      });
      if (msgErr) fail("Message landlord", msgErr.message);
      else pass("Message landlord", `new thread ${inquiryId.slice(0, 8)}`);
    }
  }

  // ── Book viewing ──
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

  // ── Demo listing guard ──
  const demoId = "a1000001-0001-4000-8000-000000000001";
  const { error: demoSaveErr } = await client
    .from("saved_properties")
    .insert({ user_id: user.id, property_id: demoId });
  if (demoSaveErr) pass("Demo listing blocked", "RLS or FK rejected demo save");
  else fail("Demo listing blocked", "demo save should not succeed");

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAuthenticated flows OK.\n");
  console.log(`Test login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
