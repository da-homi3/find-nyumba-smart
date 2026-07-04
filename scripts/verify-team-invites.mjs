/**
 * Verify agency/manager team invite flow against Supabase (RLS + data).
 * Usage: node scripts/verify-team-invites.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PASSWORD = "NyumbaPortalTest!2026";

const USERS = {
  manager: "smoke-manager@nyumbasearch.app",
  agency: "smoke-agency@nyumbasearch.app",
};

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch {
    /* env optional */
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

async function signIn(url, anonKey, email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error(`sign in failed: ${email}`);
  return client;
}

async function findUserByEmail(admin, email) {
  const normalized = email.toLowerCase();
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function getOrgId(admin, userId) {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data;
}

async function testPortal(admin, url, anonKey, ownerEmail, portalRole, orgType, inviteEmail) {
  const label = portalRole === "agency" ? "Agency" : "Manager";
  console.log(`\n— ${label} team invite —`);

  const ownerClient = await signIn(url, anonKey, ownerEmail);
  const {
    data: { user: owner },
  } = await ownerClient.auth.getUser();
  if (!owner) {
    fail(`${label}: owner session`);
    return;
  }
  pass(`${label}: owner sign-in`, ownerEmail);

  let orgRow = await getOrgId(admin, owner.id);
  if (!orgRow?.organization_id) {
    const slug = `smoke-${portalRole}-${owner.id.slice(0, 8)}`;
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: `Smoke ${label}`, slug, type: orgType })
      .select("id")
      .single();
    if (orgErr) {
      fail(`${label}: create org`, orgErr.message);
      return;
    }
    await admin.from("organization_members").insert({
      organization_id: org.id,
      user_id: owner.id,
      role: "owner",
    });
    orgRow = { organization_id: org.id, role: "owner" };
    pass(`${label}: org bootstrapped`, org.id.slice(0, 8));
  } else {
    pass(`${label}: org exists`, orgRow.organization_id.slice(0, 8));
  }

  const orgId = orgRow.organization_id;

  // RLS: user client sees at least own membership row
  const { data: rlsMembers, error: rlsErr } = await ownerClient
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  if (rlsErr) {
    fail(`${label}: read own membership (RLS)`, rlsErr.message);
  } else if (!(rlsMembers ?? []).some((m) => m.user_id === owner.id)) {
    fail(
      `${label}: read own membership (RLS)`,
      `owner row not visible (${rlsMembers?.length ?? 0} rows)`,
    );
  } else {
    pass(`${label}: read own membership (RLS)`, `${rlsMembers?.length ?? 0} visible to owner`);
  }

  // Clean prior test invitee
  const prior = await findUserByEmail(admin, inviteEmail);
  if (prior) {
    await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", prior.id);
  }

  // Simulate inviteOrgTeamMember
  let invitee = prior;
  const isNew = !invitee;
  if (!invitee) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: inviteEmail,
      password: `${randomUUID()}Aa1!`,
      email_confirm: true,
      user_metadata: { full_name: `Test ${label} Member`, source: "org_team_invite" },
    });
    if (createErr || !created.user) {
      fail(`${label}: create invitee`, createErr?.message ?? "no user");
      return;
    }
    invitee = created.user;
    await admin.from("profiles").upsert({ id: invitee.id, full_name: `Test ${label} Member` });
    pass(`${label}: create invitee`, inviteEmail);
  }

  const { error: memberErr } = await admin.from("organization_members").insert({
    organization_id: orgId,
    user_id: invitee.id,
    role: "pending",
  });
  if (memberErr) {
    fail(`${label}: add pending member`, memberErr.message);
    return;
  }
  pass(`${label}: pending member added`);

  await admin
    .from("user_roles")
    .upsert(
      { user_id: invitee.id, role: portalRole },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  await admin
    .from("user_roles")
    .upsert(
      { user_id: invitee.id, role: "tenant" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

  const { data: afterInvite, error: afterErr } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId);
  if (afterErr) {
    fail(`${label}: admin list after invite`, afterErr.message);
  } else if ((afterInvite?.length ?? 0) < 2) {
    fail(
      `${label}: admin list after invite`,
      `expected 2+ members, got ${afterInvite?.length ?? 0}`,
    );
  } else {
    pass(`${label}: admin list after invite`, `${afterInvite.length} members in org`);
  }

  // Approve
  const { data: approved, error: approveErr } = await admin
    .from("organization_members")
    .update({ role: "member" })
    .eq("organization_id", orgId)
    .eq("user_id", invitee.id)
    .eq("role", "pending")
    .select("user_id")
    .maybeSingle();
  if (approveErr || !approved) {
    fail(`${label}: approve`, approveErr?.message ?? "no row");
  } else {
    pass(`${label}: approve member`);
  }

  // Invitee sign-in
  if (isNew) {
    await admin.auth.admin.updateUserById(invitee.id, { password: PASSWORD });
  }
  const memberClient = await signIn(url, anonKey, inviteEmail);
  const {
    data: { user: memberUser },
  } = await memberClient.auth.getUser();
  if (!memberUser) {
    fail(`${label}: invitee sign-in`);
    return;
  }
  pass(`${label}: invitee sign-in`);

  const { data: memberMembership } = await memberClient
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", memberUser.id)
    .maybeSingle();
  if (memberMembership?.role !== "member") {
    fail(`${label}: invitee membership`, memberMembership?.role ?? "missing");
  } else {
    pass(`${label}: invitee is member`);
  }

  // Cleanup invitee from org (keep user for reuse)
  await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", invitee.id);
  pass(`${label}: cleanup invitee`);
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    console.error("Missing Supabase env (.env with SUPABASE_URL, keys)");
    process.exit(1);
  }

  console.log("\nNyumbaSearch — team invite verification\n");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const ts = Date.now();
  await testPortal(
    admin,
    url,
    anonKey,
    USERS.agency,
    "agency",
    "agency",
    `smoke-agency-invite-${ts}@nyumbasearch.app`,
  );
  await testPortal(
    admin,
    url,
    anonKey,
    USERS.manager,
    "manager",
    "property_manager",
    `smoke-manager-invite-${ts}@nyumbasearch.app`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("\nFailed:");
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
