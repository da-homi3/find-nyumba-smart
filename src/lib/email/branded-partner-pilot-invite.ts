/** Branded Property Partnership Pilot invite — Azizi Realtors layout. */

import { getBrandLogoUrl, getSiteUrl } from "@/lib/site";

const GREEN = "#0A5C47";
const GREEN_DEEP = "#064033";
const GREEN_SOFT = "#EEF6F2";
const GREEN_LINE = "#D5E8DF";
const TEXT = "#1B2B24";
const MUTED = "#5F6F67";
const FOOTER_HOUSE =
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=80";

/** Tiny email-safe icon: green circle with a letter mark (no emoji, no data-URI). */
function featureMark(letter: string, title: string, body: string): string {
  return `
    <td width="25%" valign="top" style="padding:4px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
        <tr>
          <td align="center" valign="middle" style="width:44px;height:44px;border-radius:22px;background:${GREEN};color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;line-height:44px;">
            ${letter}
          </td>
        </tr>
      </table>
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${GREEN};letter-spacing:-0.01em;">${title}</p>
      <p style="margin:0;font-size:12px;line-height:1.55;color:${MUTED};">${body}</p>
    </td>`;
}

export function brandedPartnerPilotInviteEmail(opts: {
  partnerName: string;
  inviteUrl: string;
  displayInviteUrl?: string;
  subject?: string;
  previewBanner?: string;
}) {
  const partner = opts.partnerName.trim() || "Partner";
  const site = getSiteUrl().replace(/\/$/, "");
  const logoUrl = getBrandLogoUrl();
  const inviteHref = opts.inviteUrl;
  const inviteShown = opts.displayInviteUrl ?? opts.inviteUrl.replace(/^https?:\/\//, "");
  const whatsappHref = `https://wa.me/254714725598?text=${encodeURIComponent(
    `Hi NyumbaSearch — I'm joining the ${partner} pilot program.`,
  )}`;
  const previewNote = opts.previewBanner
    ? `<tr><td style="padding:10px 14px;font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#7A5A10;background:#FFF8E8;border-left:3px solid #C9A227;">
        <strong>Preview:</strong> ${opts.previewBanner}
      </td></tr><tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>`
    : "";

  const feature = (letter: string, title: string, body: string) => featureMark(letter, title, body);

  const benefit = (label: string) =>
    `<td style="font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.92);text-align:center;padding:0 6px;font-family:Arial,Helvetica,sans-serif;">${label}</td>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${opts.subject ?? `Welcome to NyumbaSearch — ${partner} Pilot Program`}</title>
</head>
<body style="margin:0;padding:0;background:#E9F0EC;font-family:Arial,Helvetica,sans-serif;color:${TEXT};">
<div style="display:none;max-height:0;overflow:hidden;">A personal invitation for ${partner} to join the NyumbaSearch Pilot Program.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9F0EC;padding:28px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid ${GREEN_LINE};">
        <!-- Header -->
        <tr>
          <td style="padding:26px 32px 20px;border-bottom:1px solid ${GREEN_LINE};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" style="width:58%;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle" style="padding-right:12px;">
                        <img src="${logoUrl}" width="40" height="40" alt="NyumbaSearch" style="display:block;border-radius:50%;background:#4A2713;" />
                      </td>
                      <td valign="middle">
                        <div style="font-size:17px;font-weight:700;color:${GREEN};letter-spacing:-0.02em;">NyumbaSearch</div>
                        <div style="font-size:9px;letter-spacing:0.16em;color:${MUTED};text-transform:uppercase;margin-top:3px;">Find · Connect · Belong</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td valign="middle" align="right" style="width:42%;font-size:11px;line-height:1.4;color:${MUTED};font-style:italic;">
                  Kenya&apos;s property marketplace<br />for a brighter tomorrow
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${previewNote}
              <tr>
                <td style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.35;font-weight:700;color:${TEXT};padding-bottom:18px;">
                  Dear ${partner} Team,
                </td>
              </tr>
              <tr>
                <td style="font-size:14.5px;line-height:1.75;color:${TEXT};padding-bottom:14px;">
                  I hope this email finds you well. I&apos;m Kevin Buluma, Founder of <strong>NyumbaSearch</strong>.
                  Following our recent conversation, I&apos;m writing to formally invite ${partner} into our Pilot Program —
                  a limited partnership built to show how NyumbaSearch can bring you more visibility, stronger enquiries,
                  and serious clients from tenants, buyers, and investors across Kenya.
                </td>
              </tr>
              <tr>
                <td style="font-size:14.5px;line-height:1.75;color:${TEXT};padding-bottom:26px;">
                  Onboarding is intentionally light. With the link below, your team can open an agency account,
                  publish listings, and start appearing on NyumbaSearch within minutes.
                </td>
              </tr>

              <!-- CTA + Help -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle" width="52%" style="padding-right:14px;">
                        <a href="${inviteHref}" style="display:inline-block;background:${GREEN};color:#ffffff !important;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.02em;padding:15px 24px;border-radius:6px;">
                          Join the Pilot Program →
                        </a>
                        <div style="margin-top:14px;">
                          <a href="${inviteHref}" style="color:${GREEN};font-size:12px;text-decoration:underline;word-break:break-all;">${inviteShown}</a>
                        </div>
                      </td>
                      <td valign="top" width="48%">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GREEN_SOFT};border:1px solid ${GREEN_LINE};border-radius:8px;">
                          <tr>
                            <td style="padding:16px 16px 14px;">
                              <div style="font-size:13px;font-weight:700;color:${GREEN};margin-bottom:8px;">Need help?</div>
                              <div style="font-size:12px;line-height:1.55;color:${MUTED};margin-bottom:10px;">
                                Our partnerships team can walk you through setup or answer anything before you start.
                              </div>
                              <div style="font-size:12px;color:${TEXT};line-height:1.8;">
                                <a href="tel:+254714725598" style="color:${TEXT};text-decoration:none;">+254 714 725 598</a><br />
                                <a href="mailto:partnerships@nyumbasearch.com" style="color:${GREEN};text-decoration:none;">partnerships@nyumbasearch.com</a><br />
                                <a href="${whatsappHref}" style="color:${GREEN};font-weight:600;text-decoration:none;">Chat with us on WhatsApp</a>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Entails -->
              <tr>
                <td style="padding:6px 0 16px;border-top:1px solid ${GREEN_LINE};">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;color:${GREEN};padding-top:18px;">
                    What the Pilot Program entails
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:28px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      ${feature("01", "List your properties", "Add homes for rent or sale. We can also support bulk uploads if you prefer.")}
                      ${feature("02", "Reach more clients", "Your listings appear in front of active seekers across Nairobi and beyond.")}
                      ${feature("03", "Track performance", "See views, enquiries, calls, and WhatsApp activity attributed to your pilot.")}
                      ${feature("04", "Dedicated support", "Work directly with our team so the pilot is set up for real results.")}
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Closing -->
              <tr>
                <td style="font-size:14.5px;line-height:1.75;color:${TEXT};padding-bottom:24px;">
                  We&apos;re genuinely glad to have ${partner} with us, and we believe this partnership can create clear
                  commercial value for your agency. If anything is unclear during setup, write or call me directly —
                  we&apos;ll help you through it.
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="top" width="56%" style="font-size:14px;line-height:1.6;color:${TEXT};">
                        Warm regards,<br /><br />
                        <strong style="font-size:15px;">Kevin Buluma</strong><br />
                        Founder, NyumbaSearch<br />
                        <span style="color:${MUTED};font-size:12px;">+254 714 725 598 · kevin@nyumbasearch.com</span>
                      </td>
                      <td valign="bottom" align="right" width="44%" style="font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;color:${MUTED};line-height:1.45;">
                        “Together, we&apos;re building a better way to live in Kenya.”
                        <div style="margin:12px 0 0 auto;width:52px;height:2px;background:${GREEN};"></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer banner -->
        <tr>
          <td style="padding:8px 16px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;background:${GREEN_DEEP};">
              <tr>
                <td width="56%" valign="middle" style="padding:24px 22px;background:${GREEN};">
                  <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-bottom:8px;">Welcome to NyumbaSearch</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#C8F0DE;line-height:1.1;margin-bottom:12px;">${partner}</div>
                  <div style="font-size:12.5px;line-height:1.6;color:rgba(255,255,255,0.92);margin-bottom:18px;">
                    Thank you for joining the pilot. Together we&apos;ll connect more people to great homes —
                    and open clearer growth for your agency.
                  </div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      ${benefit("More visibility")}
                      ${benefit("Quality enquiries")}
                      ${benefit("Business growth")}
                      ${benefit("A stronger market")}
                    </tr>
                  </table>
                </td>
                <td width="44%" valign="bottom" height="230" style="background:${GREEN_DEEP};background-image:url('${FOOTER_HOUSE}');background-size:cover;background-position:center;">
                  <div style="padding:18px;text-align:right;background:linear-gradient(transparent, rgba(0,0,0,0.35));">
                    <span style="display:inline-block;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;">
                      Let&apos;s build bigger together.
                    </span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:4px 32px 24px;font-size:11px;color:${MUTED};text-align:center;">
            © ${new Date().getFullYear()} NyumbaSearch · Nairobi, Kenya ·
            <a href="${site}" style="color:${GREEN};text-decoration:none;">${site.replace(/^https?:\/\//, "")}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `Dear ${partner} Team,

I'm Kevin Buluma, Founder of NyumbaSearch. Following our recent conversation, I'm writing to formally invite ${partner} into our Pilot Program.

Join here: ${inviteHref}

Need help?
+254 714 725 598
partnerships@nyumbasearch.com

Warm regards,
Kevin Buluma
Founder, NyumbaSearch
+254 714 725 598 · kevin@nyumbasearch.com`;

  return {
    subject: opts.subject ?? `Welcome to NyumbaSearch — ${partner} Pilot Program`,
    html,
    text,
  };
}
