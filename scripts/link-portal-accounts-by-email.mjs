#!/usr/bin/env node
/**
 * Link portal roles (landlord / manager / agency) onto the canonical auth user for an email.
 * If duplicate auth users exist for the same email (rare), merges portal data into the newest
 * confirmed account and deletes the orphan auth user when safe.
 *
 * Usage:
 *   node scripts/link-portal-accounts-by-email.mjs --email user@example.com --role manager [--org "Org Name"] [--phone 07XXXXXXXX]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LISTER_ROLES = new Set(["landlord", "manager", "agency"]);

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
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
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

function activePortalForRole(role) {
  if (role === "landlord") return "landlord";
  if (role === "agency") return "agency";
  return "manager";
}

async function listUsersByEmail(admin, email) {
  const normalized = email.trim().toLowerCase();
  const users = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.toLowerCase() === normalized) users.push(u);
    }
    if (data.users.length < 200) break;
  }
  return users;
}

function pickCanonicalUser(users) {
  if (users.length === 0) return null;
  const confirmed = users.filter((u) => u.email_confirmed_at);
  const pool = confirmed.length > 0 ? confirmed : users;
  return [...pool].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

const USER_ID_TABLES = [
  "user_roles",
  "portal_applications",
  "subscriptions",
  "organization_members",
  "properties",
  "saved_properties",
  "inquiries",
  "service_providers",
];

async function mergeUserRecords(admin, fromUserId, toUserId) {
  const moved = [];
  for (const table of USER_ID_TABLES) {
    const { data, error } = await admin.from(table).select("id").eq("user_id", fromUserId).limit(1);
    if (error) continue;
    if (!data?.length) continue;

    const { error: updateErr } = await admin
      .from(table)
      .update({ user_id: toUserId })
      .eq("user_id", fromUserId);
    if (!updateErr) moved.push(table);
  }
  return moved;
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

  await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });
  return org.id;
}

function trialPlanForRole(role) {
  if (role === "agency") return "agency-pro";
  if (role === "landlord") return "pro";
  return "manager-team";
}

function trialAmountForRole(role) {
  if (role === "agency") return 15000;
  if (role === "landlord") return 4999;
  return 7500;
}

async function startTrialIfNeeded(admin, userId, role) {
  const plan = trialPlanForRole(role);
  const amount = trialAmountForRole(role);

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id,status,trial_end")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existing)
    return { started: false, subscriptionId: existing.id, trialEnd: existing.trial_end };

  const trialEnd = addDaysFromNow(30);
  const { data: sub, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan,
      status: "trialing",
      amount_kes: amount,
      billing_cycle: "monthly",
      payment_method: "mpesa",
      next_billing_date: trialEnd,
      trial_end: trialEnd,
    })
    .select("id,trial_end")
    .single();
  if (error) throw error;

  await admin
    .from("profiles")
    .update({ landlord_plan: plan, is_portal_active: true })
    .eq("id", userId);

  return { started: true, subscriptionId: sub.id, trialEnd: sub.trial_end };
}

async function grantPortalAccess(admin, { userId, role, organizationName, phone, fullName }) {
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
      organizationName,
      orgType: "property_manager",
    });
  } else if (role === "agency") {
    organizationId = await ensureOrganization(admin, {
      userId,
      organizationName,
      orgType: "agency",
    });
  }

  const now = new Date().toISOString();
  const { data: existingApp } = await admin
    .from("portal_applications")
    .select("id")
    .eq("user_id", userId)
    .eq("requested_role", role)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const appPayload = {
    user_id: userId,
    requested_role: role,
    organization_name: organizationName,
    phone,
    status: "approved",
    reviewed_at: now,
    rejection_reason: null,
    updated_at: now,
  };

  if (existingApp?.id) {
    await admin.from("portal_applications").update(appPayload).eq("id", existingApp.id);
  } else {
    await admin.from("portal_applications").insert({ ...appPayload, created_at: now });
  }

  await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    phone,
    active_portal: activePortalForRole(role),
    updated_at: now,
  });

  const trial = await startTrialIfNeeded(admin, userId, role);
  return { organizationId, trial };
}

try {
  const args = parseArgs(process.argv);
  const email = args.email?.trim().toLowerCase();
  const role = args.role ?? "manager";
  const fullName = args.name;
  const phone = args.phone;
  const org = args.org;

  if (!email) {
    console.error(
      'Usage: node scripts/link-portal-accounts-by-email.mjs --email <email> --role manager --name "Full Name" --phone 07XXXXXXXX [--org "Org"]',
    );
    process.exit(1);
  }
  if (!LISTER_ROLES.has(role)) {
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
  const matches = await listUsersByEmail(admin, email);
  if (matches.length === 0) {
    console.error(`No auth user found for ${email}`);
    process.exit(1);
  }

  const canonical = pickCanonicalUser(matches);
  const orphans = matches.filter((u) => u.id !== canonical.id);
  const mergedFrom = [];

  for (const orphan of orphans) {
    const moved = await mergeUserRecords(admin, orphan.id, canonical.id);
    if (moved.length > 0) {
      mergedFrom.push({ userId: orphan.id, tables: moved });
      await admin.auth.admin.deleteUser(orphan.id);
    }
  }

  const meta = canonical.user_metadata ?? {};
  const resolvedName = fullName ?? meta.full_name ?? canonical.email?.split("@")[0] ?? "User";
  const resolvedPhone = phone ? formatPhone254(phone) : (meta.phone ?? null);
  const resolvedOrg =
    org ??
    meta.organization_name ??
    (resolvedName ? `${resolvedName} Property Management` : "Property Management");

  await admin.auth.admin.updateUserById(canonical.id, {
    user_metadata: {
      ...meta,
      full_name: resolvedName,
      phone: resolvedPhone,
      role,
      organization_name: resolvedOrg,
    },
  });

  const activation = await grantPortalAccess(admin, {
    userId: canonical.id,
    role,
    organizationName: resolvedOrg,
    phone: resolvedPhone,
    fullName: resolvedName,
  });

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", canonical.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        linked: true,
        email,
        canonicalUserId: canonical.id,
        duplicateUsersMerged: mergedFrom,
        roles: roles?.map((r) => r.role) ?? [],
        organizationId: activation.organizationId,
        trial: activation.trial,
        dashboardUrl: `https://nyumbasearch.com/${role}/dashboard`,
        settingsUrl: "https://nyumbasearch.com/settings",
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(err);
  process.exit(1);
}
