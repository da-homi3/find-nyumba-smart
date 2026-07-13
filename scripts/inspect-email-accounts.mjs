#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/inspect-email-accounts.mjs <email>");
  process.exit(1);
}

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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[t.slice(0, eq).trim()] = val;
  }
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, { auth: { persistSession: false } });

const users = [];
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  for (const u of data.users) {
    if (u.email?.toLowerCase() === email) users.push(u);
  }
  if (data.users.length < 200) break;
}

console.log(JSON.stringify({ email, authUserCount: users.length }, null, 2));

for (const u of users) {
  const [roles, profile, apps, subs, orgMembers, properties] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", u.id),
    admin.from("profiles").select("id,full_name,phone,active_portal").eq("id", u.id).maybeSingle(),
    admin
      .from("portal_applications")
      .select("id,requested_role,status,created_at")
      .eq("user_id", u.id),
    admin.from("subscriptions").select("id,plan,status,current_period_end").eq("user_id", u.id),
    admin.from("organization_members").select("organization_id,role").eq("user_id", u.id),
    admin.from("properties").select("id,title").eq("landlord_id", u.id).limit(5),
  ]);

  console.log(
    JSON.stringify(
      {
        userId: u.id,
        createdAt: u.created_at,
        confirmedAt: u.email_confirmed_at,
        metadata: u.user_metadata,
        roles: roles.data?.map((r) => r.role) ?? [],
        rolesError: roles.error?.message,
        profile: profile.data,
        applications: apps.data,
        subscriptions: subs.data,
        subscriptionsError: subs.error?.message,
        orgMembers: orgMembers.data,
        propertyCountSample: properties.data?.length ?? 0,
      },
      null,
      2,
    ),
  );
}

const { data: phoneProfiles, error: phoneErr } = await admin
  .from("profiles")
  .select("id,full_name,phone,active_portal")
  .or("phone.eq.+254740761628,phone.eq.0740761628,phone.eq.254740761628");

if (process.argv[3] === "--phone-check") {
  console.log(JSON.stringify({ phoneProfiles, phoneErr: phoneErr?.message }, null, 2));
}
