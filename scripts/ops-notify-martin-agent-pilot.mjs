/**
 * Notify Martin Adwogo of agent + pilot enrollment.
 * Run: node scripts/ops-notify-martin-agent-pilot.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sgMail from "@sendgrid/mail";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TO = "martinadwogo@gmail.com";
const NAME = "Martin";
const DASHBOARD = "https://nyumbasearch.com/agent/dashboard";
const PILOT = "https://nyumbasearch.com/invite/partner-35d5a8ce";

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

function baseLayout({ preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NyumbaSearch</title></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Georgia,'Times New Roman',serif;color:#14231c;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2ebe6">
        <tr><td style="background:#0A5C47;padding:20px 28px;color:#fff;font-size:18px;font-weight:700;letter-spacing:0.02em">NyumbaSearch</td></tr>
        <tr><td style="padding:28px;font-size:16px;line-height:1.55">${body}</td></tr>
        <tr><td style="padding:0 28px 28px;font-size:12px;color:#6b7c74;line-height:1.4">
          © 2026 NyumbaSearch · Nairobi, Kenya
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function main() {
  const env = loadEnv();
  const apiKey = env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY missing");

  const fromEmail =
    env.EMAIL_FROM_ADDRESS?.trim() || env.SENDGRID_FROM_EMAIL?.trim() || "hello@nyumbasearch.com";
  const fromName = env.EMAIL_FROM_NAME?.trim() || "NyumbaSearch";

  const subject = "You're approved as an Independent Agent — NyumbaSearch pilot";
  const text = `Hi ${NAME},

Good news — we've updated your NyumbaSearch account.

Instead of a landlord account, you're now set up as an Independent Real Estate Agent under GOMAX REALTY, and you've been enrolled in our partner pilot program.

What this means:
• Agent portal access to list and manage client properties
• Pilot partnership status (REAL_ESTATE_AGENT) for 30 days
• Tools for leads, analytics, and team as you grow

Open your agent dashboard: ${DASHBOARD}
Pilot partner page: ${PILOT}

If anything looks wrong, reply to this email and we'll help.

— NyumbaSearch`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;color:#0A5C47">You're an Independent Agent</h1>
    <p style="margin:0 0 12px">Hi ${NAME},</p>
    <p style="margin:0 0 12px">We've updated your NyumbaSearch account. Instead of a landlord profile, you're now approved as an <strong>Independent Real Estate Agent</strong> for <strong>GOMAX REALTY</strong>, and you've been enrolled in our <strong>partner pilot program</strong>.</p>
    <div style="margin:16px 0;padding:16px;border-radius:12px;background:#f0f7f4;border:1px solid #d5e8df">
      <p style="margin:0"><strong>Role:</strong> Independent agent</p>
      <p style="margin:8px 0 0"><strong>Organization:</strong> GOMAX REALTY</p>
      <p style="margin:8px 0 0"><strong>Pilot:</strong> REAL_ESTATE_AGENT · active (30 days)</p>
    </div>
    <p style="margin:0 0 16px">You can list client properties, manage leads, and use the agent portal tools.</p>
    <p style="margin:0 0 10px">
      <a href="${DASHBOARD}" style="display:inline-block;background:#0A5C47;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Open agent dashboard</a>
    </p>
    <p style="margin:0 0 12px;font-size:14px"><a href="${PILOT}" style="color:#0A5C47">View your pilot partner page</a></p>
    <p style="margin:0;font-size:14px;color:#5a6b63">Questions? Just reply to this email — we're happy to help.</p>
  `;

  sgMail.setApiKey(apiKey);
  const [response] = await sgMail.send({
    to: TO,
    from: { email: fromEmail, name: fromName },
    subject,
    text,
    html: baseLayout({
      preheader: "Your account is now an Independent Agent on the NyumbaSearch pilot.",
      body,
    }),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        to: TO,
        statusCode: response.statusCode,
        messageId: response.headers?.["x-message-id"],
        subject,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (err) {
  console.error(err?.response?.body ?? err);
  process.exit(1);
}
