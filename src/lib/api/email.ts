import sgMail from '@sendgrid/mail';

// Initialise SendGrid with API key from env (set in wrangler.toml)
if (typeof process !== 'undefined' && process.env?.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Sends an email to the landlord when a tenant creates an inquiry.
 * Expects the inquiry object containing listingId, tenantId, message, contactEmail.
 * The landlord's email should be fetched from the listing record (placeholder here).
 */
export async function sendInquiryEmail(inquiry: {
  id: string;
  listingId: string;
  tenantId: string;
  message: string;
  contactEmail: string;
}) {
  // Fetch listing to get landlord email – using KV directly for simplicity
  const kv = (globalThis as any).NYUMBA_LISTINGS as any;
  const listingRaw = await kv.get(`listing:${inquiry.listingId}`);
  if (!listingRaw) throw new Error('Listing not found');
  const listing = JSON.parse(listingRaw);
  const landlordEmail = listing.landlordEmail || 'landlord@example.com'; // fallback

  const msg = {
    to: landlordEmail,
    from: 'no-reply@nyumba-search.workers.dev',
    subject: `New inquiry for ${listing.title}`,
    text: `You have received a new inquiry from ${inquiry.contactEmail}:

${inquiry.message}`,
    html: `<p>You have received a new inquiry from <strong>${inquiry.contactEmail}</strong>:</p><p>${inquiry.message}</p>`,
  };

  await sgMail.send(msg);
}
