#!/usr/bin/env node
/**
 * Provision or upgrade a landlord / manager / agency portal account.
 *
 * Usage:
 *   node scripts/provision-portal-lister.mjs --email user@example.com --role manager --name "Full Name" --phone 0740761628 --org "Company Name"
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) throw new Error("Missing .env");
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[t.slice(0, eq).trim()] = val;
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v && !env[k]) env[k] = v;
  }
  return env;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    out[name] = value;
    i++;
  }
  return out;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 48);
}

function formatPhone254(phone) {
  let clean = phone.replaceAll(/\s+/g, "").replaceAll("+", "");
  if (clean.startsWith("0")) clean = `254${clean.slice(1)}`;
  else if (clean.startsWith("7") || clean.startsWith("1")) clean = `254${clean}`;
  return `+${clean}`;
}

function addDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const MANAGER_TRIAL_PLAN = "manager-team";
const MANAGER_TRIAL_PRICE_KES = 4999;

async function findUserByEmail(admin, email) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < 200) break;
    page++;
  }
  return null;
}

async function ensureOrganization(admin, { userId, organizationName, orgType }) {
  const slug = `${slugify(organizationName)}-${userId.slice(0, 8)}`;
  const { data: existingMember } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existingMember?.organization_id) return existingMember.organization_id;

  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name: organizationName, slug, type: orgType })
    .select("id")
    .single();
  if (error) throw error;

  const { error: memberErr } = await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });
  if (memberErr) throw memberErr;
  return org.id;
}

async function startManagerTrial(admin, userId) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existing) return { started: false, reason: "existing_subscription" };

  const trialEnd = addDaysFromNow(30);
  const { data: sub, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: MANAGER_TRIAL_PLAN,
      status: "trialing",
      amount_kes: MANAGER_TRIAL_PRICE_KES,
      billing_cycle: "monthly",
      payment_method: "mpesa",
      next_billing_date: trialEnd,
      trial_end: trialEnd,
    })
    .select("id")
    .single();
  if (error) throw error;

  await admin
    .from("profiles")
    .update({ landlord_plan: MANAGER_TRIAL_PLAN, is_portal_active: true })
    .eq("id", userId);

  return { started: true, trialEnd, subscriptionId: sub.id };
}

async function upsertApprovedApplication(admin, { userId, role, organizationName, phone }) {
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("portal_applications")
    .select("id")
    .eq("user_id", userId)
    .eq("requested_role", role)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    user_id: userId,
    requested_role: role,
    organization_name: organizationName ?? null,
    phone: phone ?? null,
    status: "approved",
    reviewed_at: now,
    rejection_reason: null,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await admin.from("portal_applications").update(payload).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await admin
    .from("portal_applications")
    .insert({ ...payload, created_at: now })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function activePortalForRole(role) {
  if (role === "landlord") return "landlord";
  if (role === "agency") return "agency";
  return "manager";
}

try {
  const args = parseArgs(process.argv);
  const email = args.email;
  const role = args.role ?? "manager";
  const fullName = args.name;
  const phone = args.phone;
  const org = args.org ?? (fullName ? `${fullName} Property Management` : "Property Management");

  if (!email || !fullName || !phone) {
    console.error(
      'Usage: node scripts/provision-portal-lister.mjs --email <email> --role manager --name "Full Name" --phone 07XXXXXXXX [--org "Org Name"]',
    );
    process.exit(1);
  }

  if (!["landlord", "manager", "agency"].includes(role)) {
    console.error("role must be landlord, manager, or agency");
    process.exit(1);
  }

  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const user = await findUserByEmail(admin, email);
  if (!user) {
    console.error(`No auth user found for ${email}`);
    process.exit(1);
  }

  const userId = user.id;
  const phone254 = formatPhone254(phone);

  await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    phone: phone254,
    active_portal: activePortalForRole(role),
    updated_at: new Date().toISOString(),
  });

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...user.user_metadata,
      full_name: fullName,
      phone: phone254,
      role,
      organization_name: org,
    },
  });

  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: false });
  await admin
    .from("user_roles")
    .upsert(
      { user_id: userId, role: "tenant" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

  let organizationId = null;
  if (role === "manager") {
    organizationId = await ensureOrganization(admin, {
      userId,
      organizationName: org,
      orgType: "property_manager",
    });
  } else if (role === "agency") {
    organizationId = await ensureOrganization(admin, {
      userId,
      organizationName: org,
      orgType: "agency",
    });
  }

  const trial = await startManagerTrial(admin, userId);
  const applicationId = await upsertApprovedApplication(admin, {
    userId,
    role,
    organizationName: org,
    phone: phone254,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId,
        email,
        role,
        fullName,
        phone: phone254,
        organizationId,
        organizationName: org,
        applicationId,
        trial,
        dashboardUrl: `https://nyumbasearch.com/${role}/dashboard`,
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(err);
  process.exit(1);
}
