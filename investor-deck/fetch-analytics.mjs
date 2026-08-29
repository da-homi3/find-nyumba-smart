#!/usr/bin/env node
/**
 * Fetch current NyumbaSearch analytics for investor deck.
 * Sources: live site (Playwright), sitemap, optional Supabase.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'analytics.json');

function fmt(n) {
  if (n == null || Number.isNaN(n)) return null;
  return `${n.toLocaleString('en-US')}+`;
}

async function fromLiveSite() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = { source: 'live_site', fetchedAt: new Date().toISOString() };

  try {
    await page.goto('https://nyumbasearch.com/', { waitUntil: 'networkidle', timeout: 60000 });
    const homeText = await page.locator('body').innerText();
    const homeMatch = homeText.match(/(\d+)\s*verified\s*homes?\s*·\s*(\d+)\s*neighborhoods?/i);
    if (homeMatch) {
      out.homepage = { verifiedHomes: parseInt(homeMatch[1], 10), neighborhoods: parseInt(homeMatch[2], 10) };
    }

    await page.goto('https://nyumbasearch.com/tenant', { waitUntil: 'networkidle', timeout: 60000 });
    const tenantText = await page.locator('body').innerText();
    const browseMatch = tenantText.match(/(\d+)\s*homes?\s*found/i) || tenantText.match(/(\d+)\s*homes\b/i);
    if (browseMatch) out.tenantBrowse = { homesListed: parseInt(browseMatch[1], 10) };

    await page.goto('https://nyumbasearch.com/services', { waitUntil: 'networkidle', timeout: 60000 });
    const servicesText = await page.locator('body').innerText();
    const provMatch = servicesText.match(/(\d+)\s*trusted\s*service\s*providers/i);
    if (provMatch) out.services = { providers: parseInt(provMatch[1], 10) };
    const catCount = (servicesText.match(/\d+\s*providers/g) || []).length;
    if (catCount) out.services = { ...out.services, categoriesWithProviders: catCount };

    const sitemap = await fetch('https://nyumbasearch.com/sitemap.xml').then((r) => r.text());
    out.sitemap = { propertyPages: (sitemap.match(/tenant\/property\//g) || []).length };
  } finally {
    await browser.close();
  }

  return out;
}

async function fromSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const count = async (table, filters = '') => {
    const res = await fetch(`${url}/rest/v1/${table}?select=id&${filters}`, {
      headers: { ...headers, Prefer: 'count=exact' },
    });
    const range = res.headers.get('content-range');
    if (!range) return null;
    const total = range.split('/')[1];
    return total === '*' ? null : parseInt(total, 10);
  };

  const [activeListings, verifiedListings, users, providers] = await Promise.all([
    count('properties', 'is_active=eq.true'),
    count('properties', 'is_active=eq.true&is_verified=eq.true'),
    count('profiles'),
    count('service_providers', 'is_active=eq.true'),
  ]);

  let leadActions = null;
  try { leadActions = await count('provider_analytics_events'); } catch { /* optional */ }

  const hoodRes = await fetch(`${url}/rest/v1/properties?select=neighborhood&is_active=eq.true&limit=2000`, { headers });
  const hoodData = hoodRes.ok ? await hoodRes.json() : [];
  const neighbourhoods = new Set(hoodData.map((r) => r.neighborhood).filter(Boolean)).size;

  const accountsRes = await fetch(`${url}/rest/v1/properties?select=owner_id&is_active=eq.true&limit=2000`, { headers });
  const accountsData = accountsRes.ok ? await accountsRes.json() : [];
  const listingAccounts = new Set(accountsData.map((r) => r.owner_id).filter(Boolean)).size;

  return {
    source: 'supabase',
    fetchedAt: new Date().toISOString(),
    listings: { active: activeListings, verified: verifiedListings, neighbourhoods },
    users,
    listingAccounts,
    services: { providers },
    leadActions,
  };
}

async function main() {
  const live = await fromLiveSite();
  let db = null;
  try { db = await fromSupabase(); } catch { /* optional */ }

  const verifiedHomes = live.homepage?.verifiedHomes ?? db?.listings?.verified ?? db?.listings?.active ?? 336;
  const neighbourhoods = live.homepage?.neighborhoods ?? db?.listings?.neighbourhoods ?? 219;
  const serviceProviders = live.services?.providers ?? db?.services?.providers ?? 214;
  const browseHomes = live.tenantBrowse?.homesListed ?? null;
  const sitemapIndexed = live.sitemap?.propertyPages ?? null;

  const analytics = {
    generatedAt: new Date().toISOString(),
    live,
    database: db,
    deck: {
      verifiedHomes,
      neighbourhoods,
      serviceProviders,
      browseHomes,
      sitemapIndexed,
      users: db?.users ?? 132,
      listingAccounts: db?.listingAccounts ?? 24,
      leadActions: db?.leadActions ?? 109,
      serviceCategories: live.services?.categoriesWithProviders ?? 24,
      display: {
        verifiedHomes: fmt(verifiedHomes),
        neighbourhoods: fmt(neighbourhoods),
        serviceProviders: fmt(serviceProviders),
        browseHomes: browseHomes ? fmt(browseHomes) : null,
        users: fmt(db?.users ?? 132),
        listingAccounts: fmt(db?.listingAccounts ?? 24),
        leadActions: fmt(db?.leadActions ?? 109),
      },
      sources: {
        verifiedHomes: live.homepage?.verifiedHomes ? 'Live site · homepage · Aug 2026' : 'Internal / reference',
        neighbourhoods: live.homepage?.neighborhoods ? 'Live site · homepage · Aug 2026' : 'Reference materials',
        serviceProviders: live.services?.providers ? 'Live site · /services · Aug 2026' : 'Reference materials',
        users: db?.users ? 'Database' : 'Internal · requires confirmation',
        listingAccounts: db?.listingAccounts ? 'Database' : 'Internal · requires confirmation',
        leadActions: db?.leadActions ? 'Database' : 'Internal · requires confirmation',
      },
      fetchedAt: live.fetchedAt,
    },
  };

  writeFileSync(OUT, JSON.stringify(analytics, null, 2));
  console.log(JSON.stringify(analytics.deck, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
