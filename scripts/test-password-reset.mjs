/**
 * Smoke-test password reset link generation + optional SendGrid send.
 * Usage: node scripts/test-password-reset.mjs [email]
 */
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const testEmail = process.argv[2]?.trim();

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const sendgridKey = env.SENDGRID_API_KEY;
const fromEmail = env.SENDGRID_FROM_EMAIL ?? "hello@nyumbasearch.co.ke";
const siteUrl = (env.PUBLIC_APP_URL ?? env.SITE_URL ?? "https://nyumbasearch.com").replace(
  /\/$/,
  "",
);

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

if (!testEmail?.includes("@")) {
  console.error("Usage: node scripts/test-password-reset.mjs user@example.com");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const redirectTo = `${siteUrl}/auth/reset`;

const { data, error } = await admin.auth.admin.generateLink({
  type: "recovery",
  email: testEmail.toLowerCase(),
  options: { redirectTo },
});

if (error) {
  console.error("generateLink failed:", error.message);
  process.exit(1);
}

const otp = data.properties?.email_otp;
const link = data.properties?.action_link;

console.log("Recovery link generated for:", testEmail);
console.log("  redirectTo:", redirectTo);
console.log("  OTP:", otp ? `${otp.slice(0, 2)}****` : "(missing)");
console.log("  action_link:", link ? "present" : "(missing)");

if (!sendgridKey) {
  console.warn("\nSENDGRID_API_KEY not set — skipping send (dry run only).");
  process.exit(0);
}

if (!otp || !link) {
  console.error("Missing email_otp or action_link from Supabase — check Auth settings.");
  process.exit(1);
}

sgMail.setApiKey(sendgridKey);
await sgMail.send({
  to: testEmail,
  from: fromEmail,
  subject: `${otp} is your NyumbaSearch password reset code (test)`,
  text: `Test reset.\nCode: ${otp}\nLink: ${link}`,
  html: `<p>Test reset code: <strong>${otp}</strong></p><p><a href="${link}">Reset password</a></p>`,
});

console.log("\n✓ Reset email sent via SendGrid. Check inbox for 6-digit code.");
