#!/usr/bin/env node
/**
 * Create Azizi Realtors pilot invite + send branded preview email.
 *
 * Default: preview to kevinbuluma9@gmail.com (does NOT email Azizi yet).
 * Usage:
 *   node scripts/send-azizi-pilot-invite-preview.mjs
 *   node scripts/send-azizi-pilot-invite-preview.mjs --to someone@example.com
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sgMail from "@sendgrid/mail";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PARTNER_NAME = "Azizi Realtors";
const SLUG = "azizi-realtors";
const SUBJECT = "Welcome to NyumbaSearch — Azizi Realtors Pilot Program";
const DEFAULT_PREVIEW_TO = "kevinbuluma9@gmail.com";
const SITE = "https://nyumbasearch.com";
const GREEN = "#0A5C47";
const GREEN_SOFT = "#E8F5F0";
const GREEN_MID = "#1A7A5C";
const TEXT = "#1a2e25";
const MUTED = "#5a6b63";
const FOOTER_HOUSE =
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=80";

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
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

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1]?.trim() || null;
}

function hashToken(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function randomTokenHex(byteLength = 32) {
  return `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`.slice(
    0,
    byteLength * 2,
  );
}

function feature(icon, title, body) {
  return `<td width="25%" valign="top" style="padding:8px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
      <div style="width:48px;height:48px;line-height:48px;margin:0 auto 10px;border-radius:50%;background:${GREEN};color:#fff;font-size:20px;">${icon}</div>
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${GREEN};">${title}</p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">${body}</p>
    </td>`;
}

function buildEmail({ inviteUrl, displayInviteUrl, previewBanner, logoUrl }) {
  const partner = PARTNER_NAME;
  const inviteHref = inviteUrl;
  const inviteShown = displayInviteUrl;
  const whatsappHref = `https://wa.me/254714725598?text=${encodeURIComponent(
    `Hi NyumbaSearch — I'm joining the ${partner} pilot program.`,
  )}`;
  const previewNote = previewBanner
    ? `<tr><td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
        <strong>PREVIEW:</strong> ${previewBanner}
      </td></tr><tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#f3f7f5;font-family:Arial,Helvetica,sans-serif;color:${TEXT};">
<div style="display:none;max-height:0;overflow:hidden;">You're invited to the NyumbaSearch Pilot Program for ${partner}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7f5;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(10,92,71,0.08);">
        <tr>
          <td style="padding:22px 28px 16px;border-bottom:1px solid #e5efe9;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" style="width:58%;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle" style="padding-right:10px;">
                        <img src="${logoUrl}" width="42" height="42" alt="NyumbaSearch" style="display:block;border-radius:50%;background:#4A2713;" />
                      </td>
                      <td valign="middle">
                        <div style="font-size:18px;font-weight:800;color:${GREEN};letter-spacing:-0.02em;">NyumbaSearch</div>
                        <div style="font-size:9px;letter-spacing:0.14em;color:${MUTED};text-transform:uppercase;margin-top:2px;">Find · Connect · Belong</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td valign="middle" align="right" style="width:42%;font-size:11px;line-height:1.35;color:${MUTED};">
                  Kenya&apos;s Property Marketplace<br />for a Brighter Tomorrow
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${previewNote}
              <tr>
                <td style="font-size:16px;font-weight:700;color:${TEXT};padding-bottom:14px;">
                  Dear ${partner} Team,
                </td>
              </tr>
              <tr>
                <td style="font-size:14px;line-height:1.7;color:${TEXT};padding-bottom:12px;">
                  I hope this email finds you well. I&apos;m Kevin Buluma, Founder of <strong>NyumbaSearch</strong>.
                  Following our recent conversation, I&apos;m excited to invite ${partner} to join our Pilot Program —
                  a limited partnership opportunity designed to showcase how NyumbaSearch can help you get more
                  visibility, enquiries, and clients from tenants, buyers and investors across Kenya.
                </td>
              </tr>
              <tr>
                <td style="font-size:14px;line-height:1.7;color:${TEXT};padding-bottom:22px;">
                  We&apos;ve made the onboarding process simple. Using the link below, you can create your agency
                  account, add your properties and start showcasing them on NyumbaSearch within minutes.
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:28px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="top" width="54%" style="padding-right:12px;">
                        <a href="${inviteHref}" style="display:inline-block;background:${GREEN};color:#ffffff !important;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:10px;">
                          Join the Pilot Program →
                        </a>
                        <div style="margin-top:12px;">
                          <a href="${inviteHref}" style="color:${GREEN_MID};font-size:12px;word-break:break-all;">${inviteShown}</a>
                        </div>
                      </td>
                      <td valign="top" width="46%">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GREEN_SOFT};border-radius:12px;">
                          <tr>
                            <td style="padding:14px 16px;">
                              <div style="font-size:13px;font-weight:700;color:${GREEN};margin-bottom:6px;">Need Help?</div>
                              <div style="font-size:12px;line-height:1.5;color:${MUTED};margin-bottom:10px;">
                                Our team is here to assist you with onboarding and any questions.
                              </div>
                              <div style="font-size:12px;color:${TEXT};line-height:1.7;">
                                +254 714 725 598<br />
                                <a href="mailto:partnerships@nyumbasearch.com" style="color:${GREEN};">partnerships@nyumbasearch.com</a><br />
                                <a href="${whatsappHref}" style="color:${GREEN};font-weight:600;">Chat with us on WhatsApp</a>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="font-size:16px;font-weight:800;color:${GREEN};padding:8px 0 14px;border-top:1px solid #e5efe9;">
                  What the Pilot Program Entails
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      ${feature("1", "List Your Properties", "Add your available properties for rent or sale. Our team can also help with bulk uploads.")}
                      ${feature("2", "Reach More Clients", "Your listings are seen by thousands of active property seekers across Kenya.")}
                      ${feature("3", "Track Performance", "Get insights on views, enquiries, calls and WhatsApp interactions.")}
                      ${feature("4", "Dedicated Support", "Work closely with our team during the pilot to ensure you get the best results.")}
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="font-size:14px;line-height:1.7;color:${TEXT};padding-bottom:20px;">
                  We&apos;re genuinely excited to have ${partner} on board and believe this partnership will create
                  real value for your business. If you have any questions or need assistance during the setup,
                  feel free to reach out directly — we&apos;re here to help.
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="top" width="55%" style="font-size:14px;line-height:1.55;color:${TEXT};">
                        Warm regards,<br /><br />
                        <strong style="font-size:15px;">Kevin Buluma</strong><br />
                        Founder, NyumbaSearch<br />
                        <span style="color:${MUTED};font-size:12px;">+254 714 725 598 | kevin@nyumbasearch.com</span>
                      </td>
                      <td valign="bottom" align="right" width="45%" style="font-size:13px;font-style:italic;color:${MUTED};">
                        “Together, we&apos;re building a better way to live in Kenya.”
                        <div style="margin:10px 0 0 auto;width:64px;height:3px;background:${GREEN};border-radius:2px;"></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;overflow:hidden;background:${GREEN};">
              <tr>
                <td width="58%" valign="middle" style="padding:22px 20px;background:${GREEN};">
                  <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);margin-bottom:6px;">Welcome to NyumbaSearch</div>
                  <div style="font-size:26px;font-weight:800;color:#b7f0d8;line-height:1.15;margin-bottom:10px;">${partner}</div>
                  <div style="font-size:12px;line-height:1.55;color:rgba(255,255,255,0.9);margin-bottom:16px;">
                    We&apos;re excited to have you on board! Thank you for joining our pilot program. Together,
                    we&apos;ll connect more people to great properties and create new opportunities for growth.
                  </div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:10px;color:#fff;text-align:center;padding:0 4px;">More Visibility</td>
                      <td style="font-size:10px;color:#fff;text-align:center;padding:0 4px;">Quality Enquiries</td>
                      <td style="font-size:10px;color:#fff;text-align:center;padding:0 4px;">Business Growth</td>
                      <td style="font-size:10px;color:#fff;text-align:center;padding:0 4px;">A Stronger Real Estate Kenya</td>
                    </tr>
                  </table>
                </td>
                <td width="42%" valign="bottom" height="220" style="background:#0b3d32;background-image:url('${FOOTER_HOUSE}');background-size:cover;background-position:center;">
                  <div style="padding:16px;text-align:right;">
                    <span style="display:inline-block;background:rgba(0,0,0,0.35);color:#fff;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;padding:8px 12px;border-radius:8px;">
                      Let&apos;s build bigger together.
                    </span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 22px;font-size:11px;color:${MUTED};text-align:center;">
            © ${new Date().getFullYear()} NyumbaSearch · Nairobi, Kenya · nyumbasearch.com
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `Dear ${partner} Team,

I'm Kevin Buluma, Founder of NyumbaSearch. You're invited to join our Pilot Program.

Join here: ${inviteHref}

Need help? +254 714 725 598 · partnerships@nyumbasearch.com

Warm regards,
Kevin Buluma
Founder, NyumbaSearch`;

  return { subject: SUBJECT, html, text };
}

async function main() {
  const env = loadEnv();
  const to = (argValue("--to") || DEFAULT_PREVIEW_TO).toLowerCase();
  const key = env.SENDGRID_API_KEY;
  const from = env.SENDGRID_FROM_EMAIL || env.EMAIL_FROM_ADDRESS || "hello@nyumbasearch.com";
  const fromName = env.EMAIL_FROM_NAME || "NyumbaSearch";
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) throw new Error("Missing SENDGRID_API_KEY");
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const start = new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);

  const { data: existing } = await admin
    .from("pilot_partnerships")
    .select("*")
    .eq("public_slug", SLUG)
    .maybeSingle();

  let pilot = existing;
  if (!pilot) {
    const { data: created, error } = await admin
      .from("pilot_partnerships")
      .insert({
        partner_name: PARTNER_NAME,
        partner_type: "REAL_ESTATE_AGENCY",
        primary_contact_email: to,
        primary_contact_name: "Azizi Realtors Team",
        status: "INVITED",
        pilot_start_date: start.toISOString().slice(0, 10),
        pilot_end_date: end.toISOString().slice(0, 10),
        pilot_duration_days: 30,
        public_slug: SLUG,
        show_partner_badge: true,
        notes: "Azizi Realtors branded pilot invite — preview first to kevinbuluma9@gmail.com",
        objectives: [],
        success_criteria: [],
        onboarding: { brandedInvite: true },
      })
      .select("*")
      .single();
    if (error) throw error;
    pilot = created;
    console.log("Created pilot:", pilot.id);
  } else {
    const { data: updated, error } = await admin
      .from("pilot_partnerships")
      .update({
        partner_name: PARTNER_NAME,
        partner_type: "REAL_ESTATE_AGENCY",
        primary_contact_email: to,
        status: existing.status === "ACTIVE" ? existing.status : "INVITED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    pilot = updated;
    console.log("Updated pilot:", pilot.id);
  }

  const rawToken = randomTokenHex(32);
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await admin
    .from("pilot_invitations")
    .update({ status: "EXPIRED" })
    .eq("pilot_id", pilot.id)
    .eq("status", "PENDING");

  const { error: inviteError } = await admin.from("pilot_invitations").insert({
    pilot_id: pilot.id,
    email: to,
    token_hash: hashToken(rawToken),
    expires_at: expires.toISOString(),
  });
  if (inviteError) throw inviteError;

  const vanityUrl = `${SITE}/invite/${SLUG}`;
  const tokenUrl = `${SITE}/partner/invite/${rawToken}`;
  // Prefer vanity URL once deployed; token URL always works as fallback in preview note.
  const inviteUrl = vanityUrl;
  const logoUrl = `${SITE}/brand/v4/logo.png`;

  const tpl = buildEmail({
    inviteUrl,
    displayInviteUrl: `nyumbasearch.com/invite/${SLUG}`,
    previewBanner:
      to === DEFAULT_PREVIEW_TO
        ? `This is a design preview only. Not sent to Azizi yet. Fallback token link: ${tokenUrl}`
        : null,
    logoUrl,
  });

  sgMail.setApiKey(key);
  await sgMail.send({
    to,
    from: `${fromName} <${from}>`,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  });

  console.log("✓ Preview email sent");
  console.log("  To:", to);
  console.log("  Subject:", tpl.subject);
  console.log("  Vanity URL:", vanityUrl);
  console.log("  Token URL:", tokenUrl);
  console.log("  Pilot ID:", pilot.id);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
