#!/usr/bin/env node
/**
 * Smoke-test SendGrid email system end-to-end.
 * Usage: node scripts/test-email-system.mjs [recipient@email.com]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sgMail from "@sendgrid/mail";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const to = process.argv[2]?.trim();

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
const key = env.SENDGRID_API_KEY;
const from = env.SENDGRID_FROM_EMAIL ?? "hello@nyumbasearch.com";
const recipient = to ?? env.OPS_NOTIFICATION_EMAIL ?? "kevinbuluma9@gmail.com";

if (!key) {
  console.error("Missing SENDGRID_API_KEY");
  process.exit(1);
}

console.log("From:", from);
console.log("To:", recipient);

sgMail.setApiKey(key);
await sgMail.send({
  to: recipient,
  from: `${env.EMAIL_FROM_NAME ?? "NyumbaSearch"} <${from}>`,
  subject: "NyumbaSearch email system test",
  text: "If you received this, SendGrid is fully operational.",
  html: "<p>If you received this, <strong>NyumbaSearch</strong> email is fully operational.</p>",
});

console.log("✓ Test email sent");
