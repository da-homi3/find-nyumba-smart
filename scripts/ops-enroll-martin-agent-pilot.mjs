/**
 * Fix portal_applications.requested_role check to include property_developer + agent.
 * Then finish Martin enrollment.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMAIL = "martinadwogo@gmail.com";
const ORG_NAME = "GOMAX REALTY";
const DISPLAY_NAME = "MARTIN ADWOGO";
const PILOT_DAYS = 31;

function loadEnv() {
  const env = {};
  for (const path of [join(root, ".env")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

async function runSql(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${body.slice(0, 800)}`);
  return body;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 48);
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data.users ?? []).find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (!data.users?.length || data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) throw new Error("Missing SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF");

  // Inspect + fix check constraint
  const inspect = await runSql(
    token,
    projectRef,
    `
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.portal_applications'::regclass AND contype = 'c';
`,
  );
  console.log("Constraints before:", inspect);

  await runSql(
    token,
    projectRef,
    `
DO $$
BEGIN
  ALTER TABLE public.portal_applications DROP CONSTRAINT IF EXISTS portal_applications_requested_role_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.portal_applications
  ADD CONSTRAINT portal_applications_requested_role_check
  CHECK (
    requested_role::text IN (
      'landlord',
      'manager',
      'agency',
      'property_developer',
      'agent',
      'caretaker',
      'admin',
      'tenant'
    )
  );
`,
  );
  console.log("Updated portal_applications_requested_role_check");

  // Persist migration file for repo history
  // (written separately)

  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = await findUserByEmail(admin, EMAIL);
  if (!user) throw new Error(`No user ${EMAIL}`);
  const userId = user.id;
  const now = new Date().toISOString();

  // Convert landlord application → agent approved (keeps history trail)
  const { data: apps } = await admin
    .from("portal_applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const landlordApp = (apps ?? []).find((a) => a.requested_role === "landlord");
  if (landlordApp) {
    const { error } = await admin
      .from("portal_applications")
      .update({
        requested_role: "agent",
        status: "approved",
        rejection_reason: null,
        notes: "Ops override: converted landlord application → independent agent + pilot",
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", landlordApp.id);
    if (error) throw error;
    console.log("Converted application to agent", landlordApp.id);
  } else {
    const { error } = await admin.from("portal_applications").insert({
      user_id: userId,
      requested_role: "agent",
      organization_name: ORG_NAME,
      phone: "0745288471",
      status: "approved",
      reviewed_at: now,
      notes: "Ops override: independent agent + pilot",
      updated_at: now,
    });
    if (error) throw error;
    console.log("Inserted approved agent application");
  }

  // Roles: agent + tenant; remove landlord
  for (const role of ["agent", "tenant"]) {
    const { error } = await admin.from("user_roles").upsert(
      { user_id: userId, role },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "landlord");
  console.log("Roles set to agent (+ tenant); landlord removed");

  // Org
  const { data: memberships } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);
  let organizationId = memberships?.[0]?.organization_id ?? null;
  if (organizationId) {
    const { error } = await admin
      .from("organizations")
      .update({ name: ORG_NAME, type: "agent" })
      .eq("id", organizationId);
    if (error) throw error;
    console.log("Org updated to agent", organizationId);
  } else {
    const slug = `${slugify(ORG_NAME)}-${userId.slice(0, 8)}`;
    const { data: org, error } = await admin
      .from("organizations")
      .insert({ name: ORG_NAME, slug, type: "agent", email: EMAIL })
      .select("id")
      .single();
    if (error) throw error;
    organizationId = org.id;
    const { error: memErr } = await admin.from("organization_members").insert({
      organization_id: organizationId,
      user_id: userId,
      role: "owner",
    });
    if (memErr) throw memErr;
    console.log("Created agent org", organizationId);
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ active_portal: "agent", full_name: DISPLAY_NAME })
    .eq("id", userId);
  if (profileErr) throw profileErr;
  console.log("Profile active_portal set to agent");

  // Pilot
  const start = new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + PILOT_DAYS);
  const publicSlug = `${slugify(ORG_NAME)}-${randomBytes(3).toString("hex")}`;

  const { data: existingPilots } = await admin
    .from("pilot_partnerships")
    .select("*")
    .ilike("primary_contact_email", EMAIL);

  let pilot = existingPilots?.[0] ?? null;
  if (pilot) {
    const { data: updated, error } = await admin
      .from("pilot_partnerships")
      .update({
        partner_name: ORG_NAME,
        partner_type: "REAL_ESTATE_AGENT",
        primary_contact_name: DISPLAY_NAME,
        primary_contact_email: EMAIL,
        primary_contact_phone: "0745288471",
        organization_id: organizationId,
        status: "ACTIVE",
        approved_at: now,
        pilot_start_date: start.toISOString().slice(0, 10),
        pilot_end_date: end.toISOString().slice(0, 10),
        pilot_duration_days: PILOT_DAYS,
        notes: "Ops enrolled from landlord application as independent agent pilot",
        updated_at: now,
      })
      .eq("id", pilot.id)
      .select("*")
      .single();
    if (error) throw error;
    pilot = updated;
  } else {
    const { data: created, error } = await admin
      .from("pilot_partnerships")
      .insert({
        partner_name: ORG_NAME,
        partner_type: "REAL_ESTATE_AGENT",
        primary_contact_name: DISPLAY_NAME,
        primary_contact_email: EMAIL,
        primary_contact_phone: "0745288471",
        organization_id: organizationId,
        status: "ACTIVE",
        approved_at: now,
        pilot_start_date: start.toISOString().slice(0, 10),
        pilot_end_date: end.toISOString().slice(0, 10),
        pilot_duration_days: PILOT_DAYS,
        public_slug: publicSlug,
        objectives: [],
        success_criteria: [],
        notes: "Ops enrolled from landlord application as independent agent pilot",
      })
      .select("*")
      .single();
    if (error) throw error;
    pilot = created;
  }

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const { data: finalApps } = await admin
    .from("portal_applications")
    .select("id, requested_role, status, organization_name")
    .eq("user_id", userId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId,
        email: EMAIL,
        roles: (roles ?? []).map((r) => r.role),
        organizationId,
        applications: finalApps,
        pilot: {
          id: pilot.id,
          partner_type: pilot.partner_type,
          status: pilot.status,
          public_slug: pilot.public_slug,
          invite_url: `https://nyumbasearch.com/invite/${pilot.public_slug}`,
          portal: "https://nyumbasearch.com/agent/dashboard",
        },
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
